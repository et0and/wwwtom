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

val load_config : path:string -> (app list, string) result
val inspect_assets : root:string -> app:app -> (report, string) result
val check : root:string -> config_path:string -> (report list, string) result
val render_text : report list -> string
val render_json : report list -> string
val has_failures : report list -> bool
