type asset_kind = JavaScript | Css

type asset = {
  path : string;
  size_bytes : int;
  kind : asset_kind;
}

type budget = {
  max_total_javascript_bytes : int option;
  max_total_css_bytes : int option;
  max_asset_bytes : int option;
}

type app = {
  name : string;
  assets_path : string;
  budget : budget;
}

type report = {
  app : app;
  assets : asset list;
  total_javascript_bytes : int;
  total_css_bytes : int;
  largest_asset : asset option;
  violations : string list;
}

let fail format = Printf.ksprintf (fun message -> Error message) format

let field fields name =
  match List.assoc_opt name fields with
  | Some value -> Ok value
  | None -> fail "Missing required field: %s" name

let string_field fields name =
  match field fields name with
  | Ok (`String value) -> Ok value
  | Ok _ -> fail "Field %s must be a string" name
  | Error message -> Error message

let optional_non_negative_int fields name =
  match List.assoc_opt name fields with
  | None -> Ok None
  | Some `Null -> Ok None
  | Some (`Int value) when value >= 0 -> Ok (Some value)
  | Some _ -> fail "Field %s must be a non-negative integer or null" name

let object_fields context = function
  | `Assoc fields -> Ok fields
  | _ -> fail "%s must be an object" context

let reject_unknown_fields ~context ~allowed fields =
  match List.find_opt (fun (name, _) -> not (List.mem name allowed)) fields with
  | None -> Ok ()
  | Some (name, _) -> fail "Unknown field %s in %s" name context

let path_components path =
  String.split_on_char '/' path
  |> List.concat_map (fun segment -> String.split_on_char '\\' segment)

let validate_relative_path ~context path =
  let components = path_components path in
  if path = "" || String.contains path '\000' || not (Filename.is_relative path) then
    fail "%s must be a non-empty relative path" context
  else if List.exists (fun component -> component = "" || component = "." || component = "..") components then
    fail "%s must not contain empty, '.' or '..' components" context
  else Ok ()

let parse_budget json =
  match object_fields "budgets" json with
  | Error message -> Error message
  | Ok fields ->
      (match
         reject_unknown_fields ~context:"budgets"
           ~allowed:[ "maxTotalJavaScriptBytes"; "maxTotalCssBytes"; "maxAssetBytes" ]
           fields
       with
      | Error message -> Error message
      | Ok () ->
          (match optional_non_negative_int fields "maxTotalJavaScriptBytes" with
          | Error message -> Error message
          | Ok max_total_javascript_bytes ->
              match optional_non_negative_int fields "maxTotalCssBytes" with
              | Error message -> Error message
              | Ok max_total_css_bytes ->
                  (match optional_non_negative_int fields "maxAssetBytes" with
                  | Error message -> Error message
                  | Ok max_asset_bytes ->
                      Ok
                        {
                          max_total_javascript_bytes;
                          max_total_css_bytes;
                          max_asset_bytes;
                        })))

let parse_app json =
  match object_fields "app" json with
  | Error message -> Error message
  | Ok fields ->
      (match
         reject_unknown_fields ~context:"app"
           ~allowed:[ "name"; "assetsPath"; "budgets" ] fields
       with
      | Error message -> Error message
      | Ok () ->
          (match string_field fields "name" with
          | Error message -> Error message
          | Ok name ->
              (match string_field fields "assetsPath" with
              | Error message -> Error message
              | Ok assets_path ->
                  (match validate_relative_path ~context:"assetsPath" assets_path with
                  | Error message -> Error message
                  | Ok () ->
                      (match field fields "budgets" with
                      | Error message -> Error message
                      | Ok budgets ->
                          (match parse_budget budgets with
                          | Error message -> Error message
                          | Ok budget -> Ok { name; assets_path; budget }))))))

let parse_config json =
  match object_fields "configuration" json with
  | Error message -> Error message
  | Ok fields ->
      (match reject_unknown_fields ~context:"configuration" ~allowed:[ "apps" ] fields with
      | Error message -> Error message
      | Ok () ->
          match field fields "apps" with
          | Error message -> Error message
          | Ok (`List apps) when apps <> [] ->
              let rec parse_apps parsed = function
                | [] -> Ok (List.rev parsed)
                | app :: rest ->
                    (match parse_app app with
                    | Error message -> Error message
                    | Ok app -> parse_apps (app :: parsed) rest)
              in
              parse_apps [] apps
          | Ok (`List _) -> fail "The apps list must not be empty"
          | Ok _ -> fail "Field apps must be a list")

let load_config ~path =
  try
    let json = Yojson.Safe.from_file path in
    parse_config json
  with
  | Sys_error message -> fail "Could not read %s: %s" path message
  | Yojson.Json_error message -> fail "Invalid JSON in %s: %s" path message

let resolve_config_path ~root path =
  if Filename.is_relative path then Filename.concat root path else path

let path_is_within ~root path =
  let root_prefix = if root = Filename.dir_sep then root else root ^ Filename.dir_sep in
  path = root
  || (String.length path > String.length root_prefix
     && String.sub path 0 (String.length root_prefix) = root_prefix)

let resolve_asset_path ~root path =
  match validate_relative_path ~context:"Asset path" path with
  | Error message -> Error message
  | Ok () ->
      (try
         let real_root = Unix.realpath root in
         let candidate = Filename.concat real_root path in
         let resolved = if Sys.file_exists candidate then Unix.realpath candidate else candidate in
         if path_is_within ~root:real_root resolved then Ok resolved
         else fail "Asset path resolves outside the repository root: %s" path
       with
      | Unix.Unix_error (error, function_name, argument) ->
          fail "Could not resolve asset path %s: %s (%s %s)" path
            (Unix.error_message error)
            function_name
            argument)

let asset_kind_of_path path =
  match String.lowercase_ascii (Filename.extension path) with
  | ".js" | ".mjs" | ".cjs" -> Some JavaScript
  | ".css" -> Some Css
  | _ -> None

let rec collect_relative_files ~directory ~relative_prefix =
  let entries = Array.to_list (Sys.readdir directory) |> List.sort String.compare in
  let rec loop files = function
    | [] -> List.rev files
    | entry :: rest ->
        let relative_path =
          if relative_prefix = "" then entry
          else Filename.concat relative_prefix entry
        in
        let path = Filename.concat directory entry in
        let stats = Unix.lstat path in
        let files =
          if stats.Unix.st_kind = Unix.S_DIR then
            collect_relative_files ~directory:path ~relative_prefix:relative_path @ files
          else if stats.Unix.st_kind = Unix.S_REG then relative_path :: files
          else files
        in
        loop files rest
  in
  loop [] entries

let make_asset ~assets_root ~assets_path relative_path =
  match asset_kind_of_path relative_path with
  | None -> None
  | Some kind ->
      let path = Filename.concat assets_root relative_path in
      let stats = Unix.lstat path in
      if stats.Unix.st_kind <> Unix.S_REG then None
      else
        Some
          {
            path = Filename.concat assets_path relative_path;
            size_bytes = stats.Unix.st_size;
            kind;
          }

let inspect_assets ~root ~app =
  match resolve_asset_path ~root app.assets_path with
  | Error message -> Error message
  | Ok assets_root ->
      if not (Sys.file_exists assets_root) then
        fail "Asset directory for %s does not exist: %s" app.name assets_root
      else
        try
          let root_stats = Unix.lstat assets_root in
          if root_stats.Unix.st_kind <> Unix.S_DIR then
            fail "Asset path for %s is not a directory: %s" app.name app.assets_path
          else
            let assets =
              collect_relative_files ~directory:assets_root ~relative_prefix:""
              |> List.filter_map (make_asset ~assets_root ~assets_path:app.assets_path)
              |> List.sort (fun left right ->
                     let size_comparison = compare right.size_bytes left.size_bytes in
                     if size_comparison = 0 then String.compare left.path right.path
                     else size_comparison)
            in
            if assets = [] then fail "No JavaScript or CSS assets found for %s" app.name
            else
              let total_javascript_bytes =
                List.fold_left
                  (fun total asset ->
                    match asset.kind with
                    | JavaScript -> total + asset.size_bytes
                    | Css -> total)
                  0 assets
              in
              let total_css_bytes =
                List.fold_left
                  (fun total asset ->
                    match asset.kind with
                    | Css -> total + asset.size_bytes
                    | JavaScript -> total)
                  0 assets
              in
              let largest_asset = List.hd assets in
              let check_limit label actual limit =
                match limit with
                | None -> []
                | Some maximum when actual <= maximum -> []
                | Some maximum ->
                    [
                      Printf.sprintf "%s is %d bytes; budget is %d bytes" label actual
                        maximum;
                    ]
              in
              let violations =
                check_limit "total JavaScript" total_javascript_bytes
                  app.budget.max_total_javascript_bytes
                @ check_limit "total CSS" total_css_bytes
                    app.budget.max_total_css_bytes
                @ check_limit "largest asset" largest_asset.size_bytes
                    app.budget.max_asset_bytes
              in
              Ok
                {
                  app;
                  assets;
                  total_javascript_bytes;
                  total_css_bytes;
                  largest_asset = Some largest_asset;
                  violations;
                }
        with
        | Sys_error message -> fail "Could not inspect %s: %s" app.name message
        | Unix.Unix_error (error, function_name, argument) ->
            fail "Could not inspect %s: %s (%s %s)" app.name
              (Unix.error_message error)
              function_name
              argument

let check ~root ~config_path =
  let config_path = resolve_config_path ~root config_path in
  match load_config ~path:config_path with
  | Error message -> Error message
  | Ok apps ->
      let rec inspect_all reports = function
        | [] -> Ok (List.rev reports)
        | app :: rest ->
            (match inspect_assets ~root ~app with
            | Error message -> Error message
            | Ok report -> inspect_all (report :: reports) rest)
      in
      inspect_all [] apps

let format_bytes bytes =
  if bytes < 1024 then Printf.sprintf "%d B" bytes
  else Printf.sprintf "%.1f KiB" (float_of_int bytes /. 1024.0)

let render_report report =
  let status = if report.violations = [] then "PASS" else "FAIL" in
  let asset_lines =
    List.map
      (fun asset -> Printf.sprintf "    %s (%s)" asset.path (format_bytes asset.size_bytes))
      report.assets
  in
  let violation_lines =
    List.map (fun violation -> "  ! " ^ violation) report.violations
  in
  String.concat "\n"
    ([
       Printf.sprintf "%s: %s" report.app.name status;
       Printf.sprintf "  JavaScript: %s" (format_bytes report.total_javascript_bytes);
       Printf.sprintf "  CSS: %s" (format_bytes report.total_css_bytes);
       Printf.sprintf "  Assets: %d" (List.length report.assets);
     ]
    @ asset_lines @ violation_lines)

let render_text reports = String.concat "\n" (List.map render_report reports) ^ "\n"

let asset_to_json asset =
  `Assoc
    [
      ("path", `String asset.path);
      ("kind", `String (match asset.kind with JavaScript -> "javascript" | Css -> "css"));
      ("sizeBytes", `Int asset.size_bytes);
    ]

let report_to_json report =
  `Assoc
    [
      ("name", `String report.app.name);
      ("assetsPath", `String report.app.assets_path);
      ("passed", `Bool (report.violations = []));
      ("totalJavaScriptBytes", `Int report.total_javascript_bytes);
      ("totalCssBytes", `Int report.total_css_bytes);
      ( "largestAsset",
        match report.largest_asset with
        | None -> `Null
        | Some asset -> asset_to_json asset );
      ("assets", `List (List.map asset_to_json report.assets));
      ("violations", `List (List.map (fun value -> `String value) report.violations));
    ]

let render_json reports =
  Yojson.Safe.to_string (`List (List.map report_to_json reports))

let has_failures reports = List.exists (fun report -> report.violations <> []) reports
