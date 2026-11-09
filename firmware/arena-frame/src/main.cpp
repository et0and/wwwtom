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

#ifndef FRAME_DEVICE_TOKEN
#define FRAME_DEVICE_TOKEN ""
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
constexpr uint32_t kHoldMs = 700;
constexpr uint32_t kStatePollMs = 15UL * 1000UL;
constexpr uint32_t kMaintenanceMs = 60UL * 1000UL;
constexpr uint32_t kWeatherRetryMs = 5UL * 60UL * 1000UL;
constexpr size_t kStateBytes = 512;
constexpr size_t kChannelBytes = 64;
constexpr uint8_t kFaceCount = 4;
constexpr int kButtonNext = 0;  // BOOT, press after boot
constexpr int kButtonPrev = 35;
constexpr int kGavinSpriteX = 20;
constexpr int kGavinSpriteY = 20;
constexpr int kGavinSpriteW = 200;
constexpr int kGavinSpriteH = 100;
constexpr int kGavinEyeWidth = 58;
constexpr int kGavinEyeHeight = 18;
constexpr int kGavinEyeY = 58;
constexpr int kGavinLeftEyeX = 84;
constexpr int kGavinRightEyeX = 156;
constexpr int kGavinLookMaxX = 32;
constexpr int kGavinLookMaxY = 8;
constexpr uint32_t kGavinFrameMs = 33;

enum class FrameMode : uint8_t { Deck, Clock, Gavin, Video, Off };
enum class GavinMood : uint8_t {
  Idle,
  Listening,
  Thinking,
  Speaking,
  Happy,
  Sleepy,
  Surprised,
};

TFT_eSPI display;
TFT_eSprite gavinFace(&display);
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
size_t page = 1;
bool hasMore = false;
uint32_t deckToken = 0;
char weatherCondition[64] = "";
char weatherTemperature[16] = "";
uint32_t weatherFetchedAt = 0;
bool clockSynced = false;
int lastOverlayMinute = -1;
uint32_t lastOverlayCheck = 0;
uint8_t face = 0;
const char *const kFaceNames[kFaceCount] = {"bar", "minimal", "big", "line"};

char statePayload[kStateBytes];
char stateChannel[kChannelBytes] = CHANNEL_SLUG;
char stateStreamUrl[kUrlBytes] = "";
FrameMode mode = FrameMode::Deck;
GavinMood gavinMood = GavinMood::Idle;
uint32_t lastStatePoll = 0;
uint32_t lastMaintenance = 0;
uint32_t weatherAttemptedAt = 0;
bool stateDirty = false;

void showMessage(const char *message) {
  display.fillScreen(TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextDatum(MC_DATUM);
  display.drawString(message, kWidth / 2, kHeight / 2, 2);
}

void setBacklight(bool isOn) {
#ifdef TFT_BL
  constexpr uint8_t onLevel = TFT_BACKLIGHT_ON;
  constexpr uint8_t offLevel = TFT_BACKLIGHT_ON == HIGH ? LOW : HIGH;
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, isOn ? onLevel : offLevel);
#else
  (void)isOn;
#endif
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

// Four faces, all of them showing the clock. The picture is pushed first;
// each face draws its own chrome on top.
void drawBarFace(const char *clockText, const char *dateText) {
  display.fillRect(0, 0, kWidth, kOverlayHeight, TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
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

void drawMinimalFace(const char *clockText) {
  display.fillRect(0, 0, 68, 22, TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextDatum(TL_DATUM);
  display.drawString(clockText, 6, 3, 2);
  if (weatherTemperature[0] != '\0') {
    display.fillRect(kWidth - 56, 0, 56, 22, TFT_BLACK);
    display.setTextDatum(TR_DATUM);
    display.drawString(weatherTemperature, kWidth - 6, 3, 2);
  }
}

void drawBigFace(const char *clockText, const char *dateText) {
  display.fillRect(0, 0, kWidth, kHeight, TFT_BLACK);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextDatum(MC_DATUM);
  display.drawString(clockText, kWidth / 2, 52, 6);
  display.drawString(dateText, kWidth / 2, 94, 2);
  display.drawString(weatherCondition, kWidth / 2, 114, 1);
}

void drawLineFace(const char *clockText) {
  display.fillRect(0, kHeight - 20, kWidth, 20, TFT_BLACK);
  char line[96];
  snprintf(
      line, sizeof(line), "%s  %s  %s", clockText, weatherTemperature, weatherCondition);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextDatum(ML_DATUM);
  display.drawString(line, 6, kHeight - 10, 2);
}

void drawFace() {
  const time_t now = time(nullptr);
  struct tm local = {};
  localtime_r(&now, &local);
  lastOverlayMinute = local.tm_min;

  char clockText[8] = "--:--";
  char dateText[24] = "";
  if (now > 1700000000) {
    strftime(clockText, sizeof(clockText), "%H:%M", &local);
    strftime(dateText, sizeof(dateText), "%a %d %b", &local);
  }

  switch (face) {
    case 1:
      drawMinimalFace(clockText);
      break;
    case 2:
      drawBigFace(clockText, dateText);
      break;
    case 3:
      drawLineFace(clockText);
      break;
    default:
      drawBarFace(clockText, dateText);
      break;
  }
}

// The picture stays put between cycles, but the clock should not. Redrawing
// only the face chrome leaves the image untouched (except on the big face,
// which is clock-only) and costs one blocking SPI write per minute.
void refreshOverlayIfNeeded() {
  const uint32_t now = millis();
  if (now - lastOverlayCheck < 1000) return;
  lastOverlayCheck = now;

  const time_t clock = time(nullptr);
  struct tm local = {};
  localtime_r(&clock, &local);
  if (local.tm_min == lastOverlayMinute) return;
  Serial.printf("[frame] overlay %02d:%02d\n", local.tm_hour, local.tm_min);
  drawFace();
}

bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
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
  if (status < 0) {
    Serial.printf("[frame] http error: %s\n", http.errorToString(status).c_str());
    if (strncmp(url, "https://", 8) == 0) {
      char tlsError[128] = {0};
      secureClient.lastError(tlsError, sizeof(tlsError));
      Serial.printf("[frame] tls: %s\n", tlsError);
    }
  }
  return status;
}

FrameMode modeFromString(const char *value) {
  if (strcmp(value, "clock") == 0) return FrameMode::Clock;
  if (strcmp(value, "gavin") == 0) return FrameMode::Gavin;
  if (strcmp(value, "video") == 0) return FrameMode::Video;
  if (strcmp(value, "off") == 0) return FrameMode::Off;
  return FrameMode::Deck;
}

GavinMood gavinMoodFromString(const char *value) {
  if (strcmp(value, "listening") == 0) return GavinMood::Listening;
  if (strcmp(value, "thinking") == 0) return GavinMood::Thinking;
  if (strcmp(value, "speaking") == 0) return GavinMood::Speaking;
  if (strcmp(value, "happy") == 0) return GavinMood::Happy;
  if (strcmp(value, "sleepy") == 0) return GavinMood::Sleepy;
  if (strcmp(value, "surprised") == 0) return GavinMood::Surprised;
  return GavinMood::Idle;
}

// The mode lives in the adapter's KV. Polling it every 15 seconds keeps the
// web UI responsive without dropping the WiFi connection between pictures.
bool fetchState() {
  char url[kUrlBytes];
  const int written = snprintf(url, sizeof(url), "%s/frame/state", ADAPTER_BASE_URL);
  if (written < 0 || static_cast<size_t>(written) >= sizeof(url)) return false;

  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(8000);
  if (!http.begin(clientFor(url), url)) return false;
  http.addHeader("Authorization", "Bearer " FRAME_DEVICE_TOKEN);
  const int status = http.GET();
  if (status != HTTP_CODE_OK) {
    http.end();
    Serial.printf("[frame] state failed: %d\n", status);
    return false;
  }
  const String body = http.getString();
  http.end();
  if (body.length() == 0 || body.length() >= sizeof(statePayload)) {
    Serial.printf("[frame] state rejected, %u bytes\n", body.length());
    return false;
  }
  memcpy(statePayload, body.c_str(), body.length());
  statePayload[body.length()] = '\0';

  JsonDocument doc;
  if (deserializeJson(doc, statePayload, body.length()) != DeserializationError::Ok) {
    Serial.println("[frame] state JSON invalid");
    return false;
  }

  const char *nextMode = doc["mode"] | "deck";
  const char *nextChannel = doc["channel"] | "";
  const char *nextStream = doc["streamUrl"] | "";
  const char *nextGavin = doc["gavinMood"] | "idle";
  const bool hasChannel = nextChannel[0] != '\0';
  if (hasChannel && strlen(nextChannel) >= sizeof(stateChannel)) {
    Serial.println("[frame] state channel too long");
    return false;
  }

  const FrameMode nextModeValue = modeFromString(nextMode);
  const bool channelChanged = hasChannel && strcmp(nextChannel, stateChannel) != 0;
  const bool modeChanged = nextModeValue != mode;
  if (channelChanged) {
    snprintf(stateChannel, sizeof(stateChannel), "%s", nextChannel);
    cursor = 0;
    page = 1;
  }
  snprintf(stateStreamUrl, sizeof(stateStreamUrl), "%s", nextStream);
  gavinMood = gavinMoodFromString(nextGavin);
  mode = nextModeValue;
  if (modeChanged || channelChanged) stateDirty = true;
  Serial.printf(
      "[frame] state mode=%s channel=%s\n",
      nextMode,
      stateChannel);
  return true;
}

void pollState() {
  const uint32_t interval = mode == FrameMode::Gavin ? 750UL : kStatePollMs;
  if (millis() - lastStatePoll < interval) return;
  lastStatePoll = millis();
  fetchState();
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
  size_t received = 0;
  const uint32_t deadline = millis() + 25000;
  while (received < bytes && static_cast<int32_t>(millis() - deadline) < 0) {
    const int available = stream->available();
    if (available <= 0) {
      delay(1);
      continue;
    }
    const size_t remaining = bytes - received;
    const size_t want =
        static_cast<size_t>(available) < remaining ? static_cast<size_t>(available) : remaining;
    const int read = stream->read(reinterpret_cast<uint8_t *>(pixels) + received, want);
    if (read > 0) received += static_cast<size_t>(read);
  }
  if (received != bytes) {
    char tlsError[128] = {0};
    secureClient.lastError(tlsError, sizeof(tlsError));
    Serial.printf(
        "[frame] short read %u/%u tls=%s\n",
        static_cast<unsigned>(received),
        static_cast<unsigned>(bytes),
        tlsError);
  }
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

// Percent-encode a path segment so a multi-word location ("New York") is a
// valid URL. Unreserved characters pass through; everything else becomes %XX.
void encodePathSegment(const char *value, char *output, size_t capacity) {
  static constexpr char kHex[] = "0123456789ABCDEF";
  size_t written = 0;
  for (const char *position = value; *position != '\0'; ++position) {
    const unsigned char character = static_cast<unsigned char>(*position);
    const bool isUnreserved =
        (character >= 'A' && character <= 'Z') ||
        (character >= 'a' && character <= 'z') ||
        (character >= '0' && character <= '9') ||
        character == '-' || character == '.' || character == '_' || character == '~';
    if (isUnreserved) {
      if (written + 1 >= capacity) break;
      output[written++] = static_cast<char>(character);
      continue;
    }
    if (written + 3 >= capacity) break;
    output[written++] = '%';
    output[written++] = kHex[character >> 4];
    output[written++] = kHex[character & 0x0F];
  }
  output[written] = '\0';
}

void fetchWeather() {
  char encodedLocation[96];
  encodePathSegment(WEATHER_LOCATION, encodedLocation, sizeof(encodedLocation));
  char url[kUrlBytes];
  const int written =
      snprintf(url, sizeof(url), "%s/weather/%s", ADAPTER_BASE_URL, encodedLocation);
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

// Clock and weather are not tied to the image cycle. Retry failed syncs and
// refresh weather while the frame sits in clock mode, too.
void maintainIfDue() {
  if (lastMaintenance != 0 && millis() - lastMaintenance < kMaintenanceMs) return;
  lastMaintenance = millis();
  if (!clockSynced) syncClock();
  if (weatherFetchedAt == 0 || millis() - weatherFetchedAt > kWeatherRefreshMs) {
    if (weatherAttemptedAt == 0 || millis() - weatherAttemptedAt >= kWeatherRetryMs) {
      weatherAttemptedAt = millis();
      fetchWeather();
    }
  }
}

bool drawCurrent() {
  const int deckWritten = snprintf(
      deckUrl,
      sizeof(deckUrl),
      "%s/arena/frame/%s?page=%u&t=%u",
      ADAPTER_BASE_URL,
      stateChannel,
      static_cast<unsigned>(page),
      static_cast<unsigned>(deckToken));
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
  hasMore = doc["hasMore"] | false;
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
      "[frame] deck=%u bytes page=%u hasMore=%d blocks=%u cursor=%u\n",
      static_cast<unsigned>(deckLength),
      static_cast<unsigned>(page),
      hasMore ? 1 : 0,
      static_cast<unsigned>(blockCount),
      static_cast<unsigned>(cursor));

  const int frameWritten = snprintf(frameUrl, sizeof(frameUrl), "%s", imageUrl);
  if (frameWritten < 0 || static_cast<size_t>(frameWritten) >= sizeof(frameUrl)) return false;
  if (!fetchFrame(frameUrl, framePixels, kFrameBytes)) return false;
  Serial.printf("[frame] drew %s\n", imageUrl);

  // pushPixels() writes the buffer bytes unchanged when swapping is off, which
  // is exactly the MSB-first order the ST7789 expects. Turning swapping on
  // would reverse every pixel.
  display.pushImage(0, 0, kWidth, kHeight, framePixels);
  drawFace();
  return true;
}

// Advance within the page; at the end, move to the next page, wrapping to
// page 1 after the last one.
void advanceFrame() {
  if (blockCount == 0) return;
  cursor++;
  if (cursor < blockCount) return;
  cursor = 0;
  page = hasMore ? page + 1 : 1;
}

void retreatFrame() {
  if (blockCount == 0) return;
  cursor = cursor == 0 ? blockCount - 1 : cursor - 1;
}

void redisplay() {
  if (blockCount == 0) return;
  display.pushImage(0, 0, kWidth, kHeight, framePixels);
  drawFace();
}

void changeFace(int delta) {
  face = static_cast<uint8_t>((face + kFaceCount + delta) % kFaceCount);
  Serial.printf("[frame] face %u (%s)\n", static_cast<unsigned>(face), kFaceNames[face]);
  if (mode == FrameMode::Clock) {
    display.fillScreen(TFT_BLACK);
    drawFace();
  } else {
    redisplay();
  }
}

// Clock mode keeps the face buttons live; hold-to-change-image is deck-only.
void handleClockButtons() {
  if (digitalRead(kButtonNext) == LOW) {
    const uint32_t pressedAt = millis();
    while (digitalRead(kButtonNext) == LOW) {
      esp_task_wdt_reset();
      delay(20);
    }
    if (millis() - pressedAt < kHoldMs) changeFace(1);
    return;
  }

  if (digitalRead(kButtonPrev) == LOW) {
    const uint32_t pressedAt = millis();
    while (digitalRead(kButtonPrev) == LOW) {
      esp_task_wdt_reset();
      delay(20);
    }
    if (millis() - pressedAt < kHoldMs) changeFace(-1);
  }
}

void waitForNext() {
  if (blockCount == 0) return;
  const uint32_t start = millis();
  while (millis() - start < kCycleMs) {
    esp_task_wdt_reset();
    pollState();
    maintainIfDue();
    if (stateDirty) return;
    if (WiFi.status() != WL_CONNECTED) return;

    if (digitalRead(kButtonNext) == LOW) {
      const uint32_t pressedAt = millis();
      while (digitalRead(kButtonNext) == LOW) {
        esp_task_wdt_reset();
        delay(20);
      }
      if (millis() - pressedAt >= kHoldMs) {
        advanceFrame();
        return;
      }
      changeFace(1);
      continue;
    }

    if (digitalRead(kButtonPrev) == LOW) {
      const uint32_t pressedAt = millis();
      while (digitalRead(kButtonPrev) == LOW) {
        esp_task_wdt_reset();
        delay(20);
      }
      if (millis() - pressedAt >= kHoldMs) {
        retreatFrame();
        return;
      }
      changeFace(-1);
      continue;
    }

    refreshOverlayIfNeeded();
    delay(50);
  }
  advanceFrame();
}

// Off, clock, and video modes have no playlist to advance. Stay here until
// the adapter reports another mode or channel.
void waitForModeChange() {
  while (true) {
    esp_task_wdt_reset();
    pollState();
    if (stateDirty) return;
    if (WiFi.status() != WL_CONNECTED) return;
    if (mode == FrameMode::Clock) {
      maintainIfDue();
      handleClockButtons();
      refreshOverlayIfNeeded();
    }
    delay(50);
  }
}


uint32_t gavinLastFrameAt = 0;
uint32_t gavinNextBlinkAt = 0;
uint32_t gavinBlinkUntil = 0;
uint32_t gavinNextLookAt = 0;
uint32_t gavinNextVerticalAt = 0;
uint32_t gavinVerticalUntil = 0;
uint32_t gavinDoubleBlinkAt = 0;
int gavinLookX = 0;
int gavinLookY = 0;
int gavinLookTargetX = 0;
int gavinLookTargetY = 0;

int gavinRandomBetween(int low, int high) {
  return low + static_cast<int>(esp_random() % static_cast<uint32_t>(high - low + 1));
}

int gavinApproach(int value, int target) {
  const int delta = target - value;
  if (delta > 1) return value + (delta / 3) + 1;
  if (delta < -1) return value + (delta / 3) - 1;
  return target;
}

void drawGavinEye(int centerX, int eyeY, int height, int shiftX, int shiftY) {
  gavinFace.fillRoundRect(
      centerX - kGavinEyeWidth / 2 + shiftX - kGavinSpriteX,
      eyeY + shiftY - kGavinSpriteY,
      kGavinEyeWidth,
      height,
      height / 2,
      TFT_WHITE);
}

void drawGavinClosedEyes(int shiftX, int shiftY) {
  const int centerY = kGavinEyeY + kGavinEyeHeight / 2 + shiftY - kGavinSpriteY;
  const int left = kGavinLeftEyeX - kGavinEyeWidth / 2 + shiftX - kGavinSpriteX;
  const int right = kGavinRightEyeX - kGavinEyeWidth / 2 + shiftX - kGavinSpriteX;
  gavinFace.fillRoundRect(left, centerY - 2, kGavinEyeWidth, 4, 2, TFT_WHITE);
  gavinFace.fillRoundRect(right, centerY - 2, kGavinEyeWidth, 4, 2, TFT_WHITE);
}

void drawGavinVerticalEyes(int shiftX, int shiftY) {
  const int centerY = kGavinEyeY + kGavinEyeHeight / 2 + shiftY - kGavinSpriteY;
  const int left = kGavinLeftEyeX - 9 + shiftX - kGavinSpriteX;
  const int right = kGavinRightEyeX - 9 + shiftX - kGavinSpriteX;
  gavinFace.fillRoundRect(left, centerY - 29, 18, 58, 9, TFT_WHITE);
  gavinFace.fillRoundRect(right, centerY - 29, 18, 58, 9, TFT_WHITE);
}

void drawGavinHappyEyes(int shiftX) {
  const float centerY =
      static_cast<float>(kGavinEyeY + kGavinEyeHeight / 2 - kGavinSpriteY);
  const float left = static_cast<float>(kGavinLeftEyeX + shiftX - kGavinSpriteX);
  const float right = static_cast<float>(kGavinRightEyeX + shiftX - kGavinSpriteX);
  gavinFace.drawWideLine(left - 24.0f, centerY + 8.0f, left, centerY - 8.0f, 7.0f, TFT_WHITE);
  gavinFace.drawWideLine(left, centerY - 8.0f, left + 24.0f, centerY + 8.0f, 7.0f, TFT_WHITE);
  gavinFace.drawWideLine(right - 24.0f, centerY + 8.0f, right, centerY - 8.0f, 7.0f, TFT_WHITE);
  gavinFace.drawWideLine(right, centerY - 8.0f, right + 24.0f, centerY + 8.0f, 7.0f, TFT_WHITE);
}

void drawGavinFace(uint32_t now) {
  gavinFace.fillSprite(TFT_BLACK);
  const int shiftX = gavinLookX;
  const int shiftY = gavinLookY;

  if (gavinMood == GavinMood::Happy) {
    drawGavinHappyEyes(shiftX);
    gavinFace.pushSprite(kGavinSpriteX, kGavinSpriteY);
    return;
  }

  if (gavinMood == GavinMood::Idle && now < gavinBlinkUntil) {
    drawGavinClosedEyes(shiftX, shiftY);
    gavinFace.pushSprite(kGavinSpriteX, kGavinSpriteY);
    return;
  }

  switch (gavinMood) {
    case GavinMood::Listening:
      drawGavinEye(kGavinLeftEyeX, kGavinEyeY - 3, 24, 0, 0);
      drawGavinEye(kGavinRightEyeX, kGavinEyeY - 3, 24, 0, 0);
      break;
    case GavinMood::Thinking:
      drawGavinEye(kGavinLeftEyeX, kGavinEyeY + 4, 10, 4, 0);
      drawGavinEye(kGavinRightEyeX, kGavinEyeY, kGavinEyeHeight, 4, 0);
      break;
    case GavinMood::Speaking: {
      const int pulse = static_cast<int>((now / 90) % 5);
      const int height = 14 + pulse * 2;
      const int eyeY = kGavinEyeY + (kGavinEyeHeight - height) / 2;
      const int wobble = (static_cast<int>((now / 120) % 3) - 1) * 4;
      drawGavinEye(kGavinLeftEyeX, eyeY, height, wobble, 0);
      drawGavinEye(kGavinRightEyeX, eyeY, height, wobble, 0);
      break;
    }
    case GavinMood::Sleepy:
      drawGavinEye(kGavinLeftEyeX, kGavinEyeY + 5, 8, 0, 0);
      drawGavinEye(kGavinRightEyeX, kGavinEyeY + 5, 8, 0, 0);
      break;
    case GavinMood::Surprised:
      drawGavinEye(kGavinLeftEyeX, kGavinEyeY - 5, 28, 0, 0);
      drawGavinEye(kGavinRightEyeX, kGavinEyeY - 5, 28, 0, 0);
      break;
    case GavinMood::Idle:
      if (now < gavinVerticalUntil) {
        drawGavinVerticalEyes(shiftX, shiftY);
      } else {
        drawGavinEye(kGavinLeftEyeX, kGavinEyeY, kGavinEyeHeight, shiftX, shiftY);
        drawGavinEye(kGavinRightEyeX, kGavinEyeY, kGavinEyeHeight, shiftX, shiftY);
      }
      break;
    case GavinMood::Happy:
      break;
  }

  gavinFace.pushSprite(kGavinSpriteX, kGavinSpriteY);
}

void updateGavinIdle(uint32_t now) {
  if (gavinNextBlinkAt == 0) gavinNextBlinkAt = now + gavinRandomBetween(1200, 7000);
  if (gavinNextLookAt == 0) gavinNextLookAt = now + gavinRandomBetween(250, 3000);
  if (gavinNextVerticalAt == 0) gavinNextVerticalAt = now + gavinRandomBetween(6000, 13000);

  if (now >= gavinNextVerticalAt) {
    gavinVerticalUntil = now + gavinRandomBetween(1400, 2600);
    gavinNextVerticalAt = now + gavinRandomBetween(7000, 16000);
  }

  if (now >= gavinNextBlinkAt) {
    gavinBlinkUntil = now + gavinRandomBetween(80, 180);
    if (gavinRandomBetween(0, 99) < 28 && gavinDoubleBlinkAt == 0) {
      gavinDoubleBlinkAt = gavinBlinkUntil + gavinRandomBetween(80, 240);
    }
    gavinNextBlinkAt = now + gavinRandomBetween(1100, 8000);
  }

  if (gavinDoubleBlinkAt != 0 && now >= gavinDoubleBlinkAt) {
    gavinBlinkUntil = now + gavinRandomBetween(70, 150);
    gavinDoubleBlinkAt = 0;
  }

  if (now >= gavinNextLookAt) {
    const bool isMicroMove = gavinRandomBetween(0, 99) < 35;
    const int rangeX = isMicroMove ? 8 : kGavinLookMaxX;
    const int rangeY = isMicroMove ? 4 : kGavinLookMaxY;
    gavinLookTargetX = gavinRandomBetween(-rangeX, rangeX);
    gavinLookTargetY = gavinRandomBetween(-rangeY, rangeY);
    gavinNextLookAt = now + gavinRandomBetween(200, 3000);
  }

  gavinLookX = gavinApproach(gavinLookX, gavinLookTargetX);
  gavinLookY = gavinApproach(gavinLookY, gavinLookTargetY);
}

// Gavin is a face-only mode: no clock, weather, text, or image overlay.
void runGavin() {
  gavinFace.setColorDepth(16);
  if (gavinFace.createSprite(kGavinSpriteW, kGavinSpriteH) == nullptr) {
    Serial.println("[frame] Gavin sprite allocation failed");
    delay(1000);
    return;
  }
  display.fillScreen(TFT_BLACK);
  gavinLastFrameAt = 0;
  gavinNextBlinkAt = millis() + gavinRandomBetween(1200, 7000);
  gavinNextLookAt = millis() + gavinRandomBetween(250, 3000);
  gavinNextVerticalAt = millis() + gavinRandomBetween(6000, 13000);
  gavinBlinkUntil = 0;
  gavinVerticalUntil = 0;
  gavinDoubleBlinkAt = 0;

  while (true) {
    esp_task_wdt_reset();
    pollState();
    if (mode != FrameMode::Gavin) break;
    if (stateDirty) stateDirty = false;
    if (WiFi.status() != WL_CONNECTED) break;
    const uint32_t now = millis();
    if (now - gavinLastFrameAt < kGavinFrameMs) {
      delay(1);
      continue;
    }
    gavinLastFrameAt = now;
    if (gavinMood == GavinMood::Idle) updateGavinIdle(now);
    drawGavinFace(now);
    delay(1);
  }

  gavinFace.deleteSprite();
  stateDirty = false;
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
  setBacklight(true);

  // Avoid an NVS write on every reconnect.
  WiFi.persistent(false);
  // A per-boot token gives the deck a fresh edge-cache key, so new are.na
  // blocks appear on the first page after a restart instead of waiting out
  // the CDN TTL.
  deckToken = esp_random();
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

  if (lastStatePoll == 0) {
    fetchState();
    lastStatePoll = millis();
  } else {
    pollState();
  }

  if (mode == FrameMode::Off) {
    setBacklight(false);
    display.fillScreen(TFT_BLACK);
    stateDirty = false;
    waitForModeChange();
    return;
  }

  setBacklight(true);

  if (mode == FrameMode::Gavin) {
    stateDirty = false;
    runGavin();
    return;
  }

  if (mode == FrameMode::Video) {
    showMessage("Video mode");
    stateDirty = false;
    waitForModeChange();
    return;
  }

  maintainIfDue();

  if (mode == FrameMode::Clock) {
    display.fillScreen(TFT_BLACK);
    drawFace();
    stateDirty = false;
    waitForModeChange();
    return;
  }

  if (!drawCurrent()) {
    Serial.println("[frame] draw failed");
    showMessage("Fetch failed");
    waitMs(kRetryMs);
    return;
  }

  stateDirty = false;
  waitForNext();
}
