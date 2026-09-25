type output_format = Text | Json

type cli = {
  root : string;
  config_path : string;
  output_format : output_format;
}

let usage =
  "Usage: bundle-checker --config PATH --root PATH [--format text|json]"

let parse_args arguments =
  let rec loop root config_path output_format = function
    | [] ->
        (match (root, config_path) with
        | Some root, Some config_path -> Ok { root; config_path; output_format }
        | None, _ -> Error "--root is required"
        | _, None -> Error "--config is required")
    | "--help" :: [] ->
        print_endline usage;
        exit 0
    | "--config" :: path :: rest -> loop root (Some path) output_format rest
    | "--root" :: path :: rest -> loop (Some path) config_path output_format rest
    | "--format" :: "text" :: rest -> loop root config_path Text rest
    | "--format" :: "json" :: rest -> loop root config_path Json rest
    | "--format" :: value :: _ ->
        Error (Printf.sprintf "Unsupported output format: %s" value)
    | option :: _ -> Error (Printf.sprintf "Unknown or incomplete option: %s" option)
  in
  loop None None Text arguments

let run cli =
  match Bundle_checker.check ~root:cli.root ~config_path:cli.config_path with
  | Error message ->
      prerr_endline message;
      2
  | Ok reports ->
      (match cli.output_format with
      | Text -> print_string (Bundle_checker.render_text reports)
      | Json -> print_endline (Bundle_checker.render_json reports));
      if Bundle_checker.has_failures reports then 1 else 0

let () =
  match parse_args (List.tl (Array.to_list Sys.argv)) with
  | Error message ->
      prerr_endline message;
      prerr_endline usage;
      exit 2
  | Ok cli -> exit (run cli)
