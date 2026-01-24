// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import type { CloudflareEnv } from "@tom/utils/services";
import { createServicesLayer } from "~/libs/runtime";

export default createHandler((event) => {
  const cf = event.nativeEvent.context.cloudflare;
  const cfEnv = cf?.env as CloudflareEnv | undefined;

  // Initialize Effect services layer for this request
  if (cfEnv) {
    event.nativeEvent.context.effectLayer = createServicesLayer(cfEnv);
  } else {
    // Fallback for local development without Cloudflare
    const devEnv: CloudflareEnv = {
      ARENA_TOKEN: process.env.ARENA_TOKEN ?? import.meta.env.ARENA_TOKEN,
      PAYLOAD_URL: process.env.PAYLOAD_URL ?? import.meta.env.PAYLOAD_URL,
      DATABASE_URL: process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? import.meta.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? import.meta.env.TELEGRAM_CHAT_ID,
      NODE_ENV: process.env.NODE_ENV ?? "development",
    };
    event.nativeEvent.context.effectLayer = createServicesLayer(devEnv);
  }

  return (
    <StartServer
      document={({ assets, children, scripts }) => (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
            <script
              type="text/javascript"
              innerHTML={`!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init ts ns yi rs os Qr es capture Hi calculateEventProperties hs register register_once register_for_session unregister unregister_for_session fs getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty vs us createPersonProfile cs Yr ps opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing ls debug O ds getPageViewId captureTraceFeedback captureTraceMetric Vr".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('phc_4JXMNYDFsQSLW33H0VWp0BZgSK8XPw0kptL0TvVVefu',{api_host:'https://us.i.posthog.com', person_profiles: 'always'})`}
            />
            {assets}
          </head>
          <body>
            <div id="app">{children}</div>
            {scripts}
          </body>
        </html>
      )}
    />
  );
});
