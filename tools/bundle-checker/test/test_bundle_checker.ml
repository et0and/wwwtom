open Bundle_checker

let fail message = failwith message

let assert_equal ~expected ~actual message =
  if expected <> actual then fail message

let assert_true condition message = if not condition then fail message

let write_file path contents =
  let channel = open_out_bin path in
  output_string channel contents;
  close_out channel

let rec remove_tree path =
  if Sys.file_exists path then
    let stats = Unix.stat path in
    if stats.Unix.st_kind = Unix.S_DIR then (
      Array.iter (fun entry -> remove_tree (Filename.concat path entry)) (Sys.readdir path);
      Unix.rmdir path)
    else Unix.unlink path

let with_temp_dir run =
  let path = Filename.temp_file "bundle-checker" "" in
  Sys.remove path;
  Unix.mkdir path 0o755;
  Fun.protect ~finally:(fun () -> remove_tree path) (fun () -> run path)

let test_inspects_javascript_and_css_assets () =
  with_temp_dir (fun root ->
      let assets_path = Filename.concat root "dist/assets" in
      Unix.mkdir (Filename.concat root "dist") 0o755;
      Unix.mkdir assets_path 0o755;
      write_file (Filename.concat assets_path "entry.js") "12345";
      write_file (Filename.concat assets_path "styles.css") "123";
      write_file (Filename.concat assets_path "entry.js.map") "ignored";
      write_file (Filename.concat assets_path "notes.txt") "ignored";
      let app =
        {
          name = "test";
          assets_path = "dist/assets";
          budget =
            {
              max_total_javascript_bytes = Some 5;
              max_total_css_bytes = Some 3;
              max_asset_bytes = Some 5;
            };
        }
      in
      match inspect_assets ~root ~app with
      | Error message -> fail message
      | Ok report ->
          assert_equal ~expected:5 ~actual:report.total_javascript_bytes "JavaScript total";
          assert_equal ~expected:3 ~actual:report.total_css_bytes "CSS total";
          assert_equal ~expected:2 ~actual:(List.length report.assets) "asset count";
          assert_equal ~expected:[] ~actual:report.violations "passing violations")

let test_reports_budget_violation () =
  with_temp_dir (fun root ->
      let assets_path = Filename.concat root "assets" in
      Unix.mkdir assets_path 0o755;
      write_file (Filename.concat assets_path "entry.js") "123456";
      let app =
        {
          name = "test";
          assets_path = "assets";
          budget =
            {
              max_total_javascript_bytes = Some 5;
              max_total_css_bytes = None;
              max_asset_bytes = Some 5;
            };
        }
      in
      match inspect_assets ~root ~app with
      | Error message -> fail message
      | Ok report ->
          assert_equal ~expected:2 ~actual:(List.length report.violations) "violation count";
          assert_true (has_failures [ report ]) "budget failure")

let () =
  test_inspects_javascript_and_css_assets ();
  test_reports_budget_violation ()
