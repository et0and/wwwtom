# are.na frame

A 1.14" T-Display that draws an are.na channel, one image at a time.

The board has no image decoder and no PSRAM, so it never sees a JPEG. The
adapter crops each block to 240×135, scales it, and sends raw RGB565 bytes.
The firmware writes those bytes straight into the panel.

```
are.na → adapter /arena/frame/:slug        deck: block ids + image URLs
         adapter /arena/frame/:slug/image/:id   240×135 RGB565, big-endian
```

## Hardware

- LilyGO / TENSTAR T-Display: ESP32-D0WD, 16MB flash, 1.14" 135×240 ST7789
- USB-C cable for power and flashing
- No wiring, no amplifier, no SD card

## Setup

1. Install [PlatformIO](https://platformio.org/) (`pipx install platformio`).
2. Copy the config:

   ```bash
   cp include/config.h.example include/config.h
   ```

3. Set your WiFi, adapter base URL, channel slug, `TIMEZONE` and
   `WEATHER_LOCATION`.
4. Build and flash:

   ```bash
   pio run --target upload
   pio device monitor
   ```

On macOS the serial port usually appears as `/dev/cu.usbserial-*` (CH9102).
If it does not appear, install the WCH CH9102 driver.

## Behaviour

- Fetches the deck once per cycle, draws the current block, then turns WiFi off.
- Holds each image for `FRAME_CYCLE_SECONDS` (default 600, so 10 minutes).
- The deck is 20 blocks per page. When the page is exhausted the firmware asks
  for the next page and wraps to page 1 after the last one.
- **Tap GPIO0** cycles the face forward; **tap GPIO35** cycles it backward.
- **Hold GPIO0** (700ms) shows the next image; **hold GPIO35** the previous one.
  GPIO0 held at reset enters the bootloader, so press after boot.
- A failed fetch shows a message and retries after 30 seconds.
- Four faces, all of them showing the clock:
  - `bar` — 30px top bar: time and temperature, date and condition below.
  - `minimal` — small clock top-left, temperature top-right, no bar.
  - `big` — clock only: large time, date and condition, image hidden.
  - `line` — full image with a 20px line at the bottom.
- The clock syncs once per boot over NTP (`time.cloudflare.com`,
  `pool.ntp.org`) with `configTzTime` and the POSIX `TIMEZONE` rule, so it
  follows NZST/NZDT without a fixed offset.
- Weather comes from the adapter's `/weather/:location`, which uses wttr.in
  with an Open-Meteo fallback and caches the result for 15 minutes. The device
  refreshes it every 15 minutes, and falls back to clock and date only when
  both providers are unavailable.

## Flash and partitions

The board is a 16MB ESP32, but PlatformIO's `esp32dev` board defaults to a 4MB
flash header. With the 16MB partition table the bootloader then rejects the
table and the board boot-loops. `board_upload.flash_size = 16MB` in
`platformio.ini` fixes it.

## Rotation

`FRAME_ROTATION` is `1` by default. Use `3` if the picture is upside down for
the way the frame sits. Both give 240×135.

## Memory

- The 64,800-byte frame is a static `uint16_t` array in `.bss`, not heap. Its
  alignment comes from the type, not from an assumption about `malloc`.
- The deck and both URLs live in fixed-size buffers. A truncated value fails
  the cycle instead of growing.
- Reads are bounded and a short read is rejected before anything is drawn.
- The only heap users are ArduinoJson and the WiFi/TLS stack. A failed
  allocation fails one cycle, not the device.
- A 120-second task watchdog reboots on a stuck TLS read.
- This sketch's own sources are compiled with `-Wall -Wextra -Wconversion
-Wshadow -fstack-protector-strong` via `build_src_flags`.

## Trust and limits

- TLS uses `setInsecure()`. That is fine for public are.na images, but it does
  not verify the adapter. Pin the Cloudflare CA before this leaves your desk.
- The deck reads 20 blocks per page. Large channels are traversed page by page.
- No OTA yet: flashing means a cable.
- No on-device cache: every cycle is two HTTPS requests. A 16MB flash has room
  for a frame cache later.

## Local testing

Run the adapter on your laptop:

```bash
pnpm dev:adapter
```

Set `ADAPTER_BASE_URL` to `http://<laptop-lan-ip>:8788`. The sketch uses a plain
`WiFiClient` for `http://` URLs, so no certificate is involved. Use the LAN IP,
not `localhost`: the board is a separate host.
