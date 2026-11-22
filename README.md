# KingAi — aplikacja iOS (Expo / React Native)

Lekka wersja KingAi na iPhone. Korzysta z tego samego backendu co strona i aplikacja desktopowa (**ai.kingops.eu**) — to samo konto i wspólna historia rozmów.

## Co jest w środku
- **Logowanie i rejestracja** (to samo konto co na ai.kingops.eu; rejestracja wymaga potwierdzenia e-mail).
- **Czat** ze strumieniowaniem odpowiedzi + **historia rozmów** (lista, otwieranie, nowa rozmowa).
- **Wybór modelu** (Auto + wszystkie dostępne modele).
- **Głos:** **dyktowanie** (mikrofon → nagranie → transkrypcja Waszym Whisperem) oraz **czytanie odpowiedzi na głos** (systemowy głos iOS). Plus **tryb rozmowy głosowej** (🎙️ w nagłówku): model czyta odpowiedź, a potem sam zaczyna słuchać kolejnej wiadomości.
- **Zdjęcia:** dołączanie z **galerii** i **aparatu** (📎) do modeli „widzących" — miniatury, do 4 na wiadomość.
- **Zakładka „Modele"** — lista dostępnych modeli z oznaczeniami (chmura/serwer, obrazy/głos, narzędzia, „myśli na głos").
- **Ustawienia** — dane konta, **pozostały limit tokenów** (+ budżet premium jeśli jest), **wylogowanie**.
- **Powiadomienia push** — aplikacja rejestruje token Expo po zalogowaniu; **admin wysyła powiadomienia z panelu** `/admin` (karta „Powiadomienia push"). Wymaga EAS build (projectId) i klucza APNs skonfigurowanego w EAS.
- **Ikona i splash screen** z logo KingAi (`assets/icon.png`, `assets/splash-icon.png`).

> **Push na iOS:** działa tylko w buildzie EAS (nie w Expo Go produkcyjnie), bo wymaga `projectId` (`eas init`) i klucza APNs — EAS konfiguruje je automatycznie przy `eas build`.

> Czego NIE ma (i nie może mieć na iOS): agenta na plikach, terminala, Discord RPC — iOS na to nie pozwala (piaskownica). To są funkcje tylko desktopowe.

## Wymagania do zbudowania pliku .ipa
Plik `.ipa` można zbudować **tylko na macOS (Xcode)** albo w **chmurze EAS** (Expo). Z Linuksa się nie da.

### Opcja A — EAS (bez Maca, zalecane)
```bash
npm i -g eas-cli
cd kingai-mobile
npm install
eas login                     # konto Expo (darmowe)

# 1) Wersja na SYMULATOR iOS (do testu, BEZ konta Apple) — zwraca .app:
eas build -p ios --profile simulator

# 2) Prawdziwy plik .ipa na iPhone (wymaga konta Apple Developer, 99 USD/rok):
eas build -p ios --profile preview     # ad-hoc .ipa (zarejestrowane urządzenia)
#   albo do App Store / TestFlight:
eas build -p ios --profile production
```
EAS poprowadzi przez logowanie do Apple i certyfikaty automatycznie. Gotowy `.ipa` pobierzesz linkiem z EAS.

### Opcja B — lokalnie na Macu
```bash
cd kingai-mobile
npm install
npx expo run:ios            # uruchamia w symulatorze
# lub: npx expo prebuild && otwórz ios/ w Xcode → Archive → Export .ipa
```

## Uruchomienie w trybie dev (podgląd na telefonie, bez budowania)
```bash
npm install
npx expo start              # zeskanuj kod QR aplikacją Expo Go (iOS)
```

## Konfiguracja
- Adres backendu: `src/api.ts` → `BASE` (domyślnie `https://ai.kingops.eu`).
- Identyfikator aplikacji iOS: `app.json` → `ios.bundleIdentifier` (`eu.kingops.kingai`).
