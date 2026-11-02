#include <Arduino.h>
#include <ArduinoJson.h>
#include <cstdio>
#include <cstring>
#include <HTTPClient.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>
#include <time.h>

#if __has_include("config.h")
#include "config.h"
#else
#error "Copy include/config.h.example to include/config.h and set your network."
#endif

namespace {

constexpr int kWidth = 240;
constexpr int kHeight = 135;
constexpr int kPixelCount = kWidth * kHeight;
constexpr size_t kFrameBytes = static_cast<size_t>(kPixelCount) * 2;
constexpr size_t kDeckBytes = 8192;
constexpr size_t kUrlBytes = 192;
#ifndef FRAME_CYCLE_SECONDS
#define FRAME_CYCLE_SECONDS 600
#endif
constexpr uint32_t kCycleMs = static_cast<uint32_t>(FRAME_CYCLE_SECONDS) * 1000UL;
constexpr uint32_t kRetryMs = 30UL * 1000UL;
constexpr uint32_t kWifiTimeoutMs = 20UL * 1000UL;
constexpr uint32_t kWatchdogMs = 120UL * 1000UL;
constexpr uint32_t kWeatherRefreshMs = 15UL * 60UL * 1000UL;
constexpr int kOverlayHeight = 30;
constexpr int kButtonNext = 0;  // BOOT, press after boot
constexpr int kButtonPrev = 35;

TFT_eSPI display;
WiFiClientSecure secureClient;
WiFiClient plainClient;

// All long-lived buffers are static. The pixel buffer is uint16_t so its
// alignment is guaranteed by the type, not assumed from malloc.
uint16_t framePixels[kPixelCount];
char deckPayload[kDeckBytes];
char deckUrl[kUrlBytes];
char frameUrl[kUrlBytes];

size_t cursor = 0;
size_t blockCount = 0;
char weatherCondition[64] = "";
char weatherTemperature[16] = "";
uint32_t weatherFetchedAt = 0;
bool clockSynced = false;

void showMessage(const char *message) {
  display.fillScreen(TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextDatum(MC_DATUM);
  display.drawString(message, kWidth / 2, kHeight / 2, 2);
}

// A hung TLS read reboots instead of freezing the frame.
void startWatchdog() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t config = {};
  config.timeout_ms = kWatchdogMs;
  config.idle_core_mask = 0;
  config.trigger_panic = true;
  if (esp_task_wdt_init(&config) == ESP_ERR_INVALID_STATE) {
    esp_task_wdt_reconfigure(&config);
  }
#else
  esp_task_wdt_init(kWatchdogMs / 1000, true);
#endif
  esp_task_wdt_add(nullptr);
}

void waitMs(uint32_t durationMs) {
  const uint32_t start = millis();
  while (millis() - start < durationMs) {
    esp_task_wdt_reset();
    delay(100);
  }
}

// The overlay is the only text on screen: clock and temperature on the first
// line, date and condition on the second. It covers the top of the picture.
void drawOverlay() {
  display.fillRect(0, 0, kWidth, kOverlayHeight, TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);

  const time_t now = time(nullptr);
  struct tm local = {};
  localtime_r(&now, &local);

  char clockText[8] = "--:--";
  char dateText[24] = "";
  if (now > 1700000000) {
    strftime(clockText, sizeof(clockText), "%H:%M", &local);
    strftime(dateText, sizeof(dateText), "%a %d %b", &local);
  }

  display.setTextDatum(TL_DATUM);
  display.drawString(clockText, 6, 2, 2);
  if (weatherTemperature[0] != '\0') {
    display.setTextDatum(TR_DATUM);
    display.drawString(weatherTemperature, kWidth - 6, 2, 2);
  }

  char lower[96];
  if (dateText[0] != '\0') {
    snprintf(lower, sizeof(lower), "%s  %s", dateText, weatherCondition);
  } else {
    snprintf(lower, sizeof(lower), "%s", weatherCondition);
  }
  display.setTextDatum(TL_DATUM);
  display.drawString(lower, 6, 20, 1);
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < kWifiTimeoutMs) {
    esp_task_wdt_reset();
    delay(200);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[frame] wifi failed, status=%d\n", static_cast<int>(WiFi.status()));
    return false;
  }
  Serial.printf(
      "[frame] wifi %s heap=%u\n",
      WiFi.localIP().toString().c_str(),
      static_cast<unsigned>(ESP.getFreeHeap()));
  return true;
}

// The adapter serves HTTPS in production and plain HTTP on a laptop. One
// client covers both, so local testing does not need a tunnel.
WiFiClient &clientFor(const char *url) {
  if (strncmp(url, "https://", 8) == 0) {
    secureClient.setInsecure();
    return secureClient;
  }
  return plainClient;
}

int httpGet(HTTPClient &http, const char *url) {
  http.setConnectTimeout(15000);
  http.setTimeout(30000);
  if (!http.begin(clientFor(url), url)) {
    Serial.printf("[frame] begin failed: %s\n", url);
    return -1;
  }
  const int status = http.GET();
  Serial.printf("[frame] GET %d %s\n", status, url);
  return status;
}

// The deck is small, but it is copied into a fixed buffer. A response larger
// than the buffer fails the cycle instead of growing without bound.
bool fetchDeck(const char *url, char *payload, size_t capacity, size_t &length) {
  HTTPClient http;
  const int status = httpGet(http, url);
  if (status != HTTP_CODE_OK) {
    http.end();
    return false;
  }
  const String body = http.getString();
  http.end();
  if (body.length() == 0 || body.length() >= capacity) {
    Serial.printf("[frame] deck rejected, %u bytes\n", body.length());
    return false;
  }
  memcpy(payload, body.c_str(), body.length());
  payload[body.length()] = '\0';
  length = body.length();
  Serial.printf("[frame] deck %u bytes\n", body.length());
  return true;
}

// Exactly kFrameBytes of big-endian RGB565 into a bounded, aligned buffer.
bool fetchFrame(const char *url, uint16_t *pixels, size_t bytes) {
  HTTPClient http;
  const int status = httpGet(http, url);
  if (status != HTTP_CODE_OK) {
    http.end();
    return false;
  }
  WiFiClient *stream = http.getStreamPtr();
  stream->setTimeout(20000);
  const size_t received =
      stream->readBytes(reinterpret_cast<uint8_t *>(pixels), bytes);
  http.end();
  Serial.printf(
      "[frame] frame %u/%u bytes\n",
      static_cast<unsigned>(received),
      static_cast<unsigned>(bytes));
  return received == bytes;
}

void syncClock() {
  // configTzTime sets TZ and starts SNTP in one call; the POSIX rule in
  // TIMEZONE carries the NZ DST transitions, so the clock follows NZST/NZDT.
  configTzTime(TIMEZONE, "time.cloudflare.com", "pool.ntp.org");
  const uint32_t start = millis();
  while (time(nullptr) < 1700000000 && millis() - start < 10000) {
    esp_task_wdt_reset();
    delay(200);
  }
  clockSynced = time(nullptr) >= 1700000000;
  if (!clockSynced) {
    Serial.println("[frame] clock not synced");
    return;
  }
  const time_t now = time(nullptr);
  struct tm local = {};
  localtime_r(&now, &local);
  char stamp[40];
  strftime(stamp, sizeof(stamp), "%Y-%m-%d %H:%M:%S %Z", &local);
  Serial.printf("[frame] clock synced: %s\n", stamp);
}

void fetchWeather() {
  char url[kUrlBytes];
  const int written =
      snprintf(url, sizeof(url), "%s/weather/%s", ADAPTER_BASE_URL, WEATHER_LOCATION);
  if (written < 0 || static_cast<size_t>(written) >= sizeof(url)) return;

  HTTPClient http;
  const int status = httpGet(http, url);
  if (status != HTTP_CODE_OK) {
    http.end();
    Serial.printf("[frame] weather failed: %d\n", status);
    return;
  }
  const String body = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, body.c_str()) != DeserializationError::Ok) {
    Serial.println("[frame] weather JSON invalid");
    return;
  }
  snprintf(weatherCondition, sizeof(weatherCondition), "%s", doc["condition"] | "");
  snprintf(weatherTemperature, sizeof(weatherTemperature), "%s", doc["temperature"] | "");
  weatherFetchedAt = millis();
  Serial.printf("[frame] weather %s %s\n", weatherCondition, weatherTemperature);
}

bool drawCurrent() {
  const int deckWritten = snprintf(
      deckUrl, sizeof(deckUrl), "%s/arena/frame/%s", ADAPTER_BASE_URL, CHANNEL_SLUG);
  if (deckWritten < 0 || static_cast<size_t>(deckWritten) >= sizeof(deckUrl)) return false;

  size_t deckLength = 0;
  if (!fetchDeck(deckUrl, deckPayload, sizeof(deckPayload), deckLength)) return false;

  JsonDocument doc;
  if (deserializeJson(doc, deckPayload, deckLength) != DeserializationError::Ok) {
    Serial.println("[frame] deck JSON invalid");
    return false;
  }

  JsonArray blocks = doc["blocks"].as<JsonArray>();
  blockCount = blocks.size();
  if (blockCount == 0) {
    Serial.println("[frame] deck has no images");
    return false;
  }

  cursor %= blockCount;
  const char *imageUrl = blocks[cursor]["imageUrl"].as<const char *>();
  if (imageUrl == nullptr || imageUrl[0] == '\0') {
    Serial.println("[frame] block has no imageUrl");
    return false;
  }
  Serial.printf(
      "[frame] deck=%u bytes blocks=%u cursor=%u\n",
      static_cast<unsigned>(deckLength),
      static_cast<unsigned>(blockCount),
      static_cast<unsigned>(cursor));

  const int frameWritten = snprintf(frameUrl, sizeof(frameUrl), "%s", imageUrl);
  if (frameWritten < 0 || static_cast<size_t>(frameWritten) >= sizeof(frameUrl)) return false;
  if (!fetchFrame(frameUrl, framePixels, kFrameBytes)) return false;
  Serial.printf("[frame] drew %s\n", imageUrl);

  // pushImage() writes memory as-is when setSwapBytes(false), which is what the
  // panel wants for big-endian frame bytes.
  display.pushImage(0, 0, kWidth, kHeight, framePixels);
  drawOverlay();
  return true;
}

void waitForNext() {
  if (blockCount == 0) return;
  const uint32_t start = millis();
  while (millis() - start < kCycleMs) {
    esp_task_wdt_reset();
    if (digitalRead(kButtonNext) == LOW) {
      cursor = (cursor + 1) % blockCount;
      while (digitalRead(kButtonNext) == LOW) {
        esp_task_wdt_reset();
        delay(50);
      }
      return;
    }
    if (digitalRead(kButtonPrev) == LOW) {
      cursor = (cursor + blockCount - 1) % blockCount;
      while (digitalRead(kButtonPrev) == LOW) {
        esp_task_wdt_reset();
        delay(50);
      }
      return;
    }
    delay(50);
  }
  cursor = (cursor + 1) % blockCount;
}

}  // namespace

void setup() {
  Serial.begin(115200);
  pinMode(kButtonNext, INPUT_PULLUP);
  pinMode(kButtonPrev, INPUT_PULLUP);

  display.init();
  display.setRotation(FRAME_ROTATION);
  display.setSwapBytes(false);
  display.fillScreen(TFT_BLACK);

  // Avoid an NVS write on every reconnect.
  WiFi.persistent(false);
  startWatchdog();
  Serial.printf(
      "[frame] boot reason=%d heap=%u\n",
      static_cast<int>(esp_reset_reason()),
      static_cast<unsigned>(ESP.getFreeHeap()));
}

void loop() {
  if (!connectWifi()) {
    showMessage("WiFi failed");
    waitMs(kRetryMs);
    return;
  }

  if (!clockSynced) syncClock();
  if (weatherFetchedAt == 0 || millis() - weatherFetchedAt > kWeatherRefreshMs) {
    fetchWeather();
  }

  if (!drawCurrent()) {
    Serial.println("[frame] draw failed");
    showMessage("Fetch failed");
    WiFi.disconnect(true);
    WiFi.mode(WIFI_OFF);
    waitMs(kRetryMs);
    return;
  }

  // No traffic while the picture sits still.
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  waitForNext();
}
