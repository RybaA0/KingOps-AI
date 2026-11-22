# Zbudowanie KingAi na iPhone

## 🏆 NAJLEPSZE: bez żadnego Maca — GitHub Actions (prawdziwy Mac w chmurze GitHuba, legalnie)
Nie trzeba nikogo z Makiem ani Proxmoksa. GitHub ma darmowe runnery **macOS** — zbudują `.ipa` same.
1. Załóż darmowe konto GitHub, stwórz **prywatne repo** i wrzuć do niego cały ten projekt (jest w nim gotowy workflow `.github/workflows/ios-ipa.yml`).
2. W repo: zakładka **Actions** → **„Build iOS IPA (unsigned)"** → **Run workflow**.
3. Po ~20 min pobierz artefakt **`KingAi-ipa`** (to jest `KingAi.ipa`).
4. Podpisz go u siebie przez **Sideloadly** (darmowy Apple ID) — jak niżej.

> Limity: prywatne repo ma ~200 min/mies. macOS za darmo (jeden build ≈ 20–30 min → kilka buildów/mies.). Publiczne repo = bez limitu. Żadnego Maca, Proxmoksa ani konta Apple do samego buildu.

---

## Instrukcja dla osoby z MacBookiem (alternatywa)

To jest aplikacja **Expo / React Native**. Backend jest gotowy (ai.kingops.eu) — nic nie trzeba stawiać. Trzeba tylko zbudować aplikację i wgrać na iPhone.

## Co potrzebne na Macu
- **macOS + Xcode** (za darmo z App Store) — przy pierwszym uruchomieniu otwórz Xcode raz, zaakceptuj licencję.
- **Node.js 20+** (https://nodejs.org) i w terminalu: `npm i -g eas-cli` (opcjonalnie).
- **Apple ID** (wystarczy darmowy do wgrania na podłączony telefon; płatny Apple Developer tylko jeśli chcesz wyeksportować plik `.ipa` do wysłania).

## Rozpakowanie projektu
```bash
# rozpakuj paczkę, którą dostałeś (kingai-mobile-src.tar.gz)
mkdir kingai-mobile && tar xzf kingai-mobile-src.tar.gz -C kingai-mobile
cd kingai-mobile
npm install
```

---

## ⭐ DROGA C — DARMOWE Apple ID: zrób NIEPODPISANY `.ipa` dla Sideloadly (ZALECANE dla Was)
Znajomy robi na Macu **niepodpisany** plik `.ipa`. Jego Apple ID **nie jest w ogóle potrzebny** do buildu — plik podpisze dopiero **właściciel iPhone przez Sideloadly na Windowsie** (swoim darmowym Apple ID). Nie trzeba podłączać telefonu do Maca, nie trzeba EAS ani konta płatnego.

```bash
cd kingai-mobile
npm install
npx expo prebuild --platform ios --clean      # generuje natywny projekt iOS
npx pod-install                                # instaluje Pody (jeśli prebuild sam nie zrobił)

cd ios
xcodebuild -workspace KingAi.xcworkspace -scheme KingAi -configuration Release \
  -sdk iphoneos -derivedDataPath build \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO

# spakuj .app do .ipa:
mkdir -p Payload
cp -R build/Build/Products/Release-iphoneos/KingAi.app Payload/
zip -r KingAi.ipa Payload
# ⬅ powstaje  ios/KingAi.ipa  — TEN PLIK wyślij właścicielowi iPhone
```
Jeśli scheme nie nazywa się `KingAi`, sprawdź: `xcodebuild -list -workspace KingAi.xcworkspace` i użyj nazwy z sekcji „Schemes".

**Potem właściciel (Windows):** Sideloadly + iTunes(x64) → podłącz iPhone + „Zaufaj" → przeciągnij `KingAi.ipa` → wpisz **swój darmowy Apple ID** → Start (2FA) → Done. Sideloadly sam podpisuje plik Twoim kontem (ważność 7 dni, potem wgraj ponownie). Na iPhonie: Ustawienia → Ogólne → VPN i zarządzanie urządzeniami → Zaufaj; Ustawienia → Prywatność → Tryb programisty → włącz + restart.

---

## DROGA A — najprościej, DARMOWE Apple ID (telefon podłączony do Maca)
Jeśli masz przy sobie iPhone właściciela (albo on Ci go podłączy):

```bash
npx expo run:ios --device
```
1. Wybierz z listy podłączonego iPhone'a.
2. Przy pytaniu o podpis: w Xcode ustaw **Signing → Team = (Personal Team / Twój Apple ID)** — darmowy wystarczy.
3. Aplikacja **sama zainstaluje się na telefonie**. Potem na iPhonie: **Ustawienia → Ogólne → VPN i zarządzanie urządzeniami → Zaufaj** swojemu Apple ID.

> Minus darmowego konta: aplikacja działa **7 dni**, potem trzeba wgrać ją ponownie tym samym sposobem. Żadnego pliku `.ipa` nie trzeba — instaluje się bezpośrednio.

---

## DROGA B — plik `.ipa` do wysłania (PŁATNE Apple Developer, 99 USD/rok)
Jeśli właściciel iPhone jest zdalnie i chcesz wysłać mu gotowy `.ipa` (do Sideloadly na Windowsie):

**Najprościej przez EAS (build w chmurze, nie obciąża Maca):**
```bash
export EXPO_TOKEN=<token_wlasciciela_z_expo.dev>   # albo: eas login
eas build --platform ios --profile preview
# zaloguj się do Apple ID gdy poprosi (2FA) — EAS sam wygeneruje certyfikaty
```
Po buildzie EAS daje link `https://expo.dev/artifacts/...` → pobierz `.ipa` → wyślij właścicielowi. (Projekt jest już połączony z Expo: `@kacperek/kingai-mobile`.)

**Albo lokalnie w Xcode:**
```bash
npx expo prebuild --platform ios
open ios/KingAi.xcworkspace
```
W Xcode: ustaw Team (płatny) → **Product → Archive** → **Distribute App → Ad Hoc / Development** → Export `.ipa`.

---

## Potem (właściciel iPhone, Windows) — tylko dla DROGI B
Zgodnie z planem: iTunes (x64) + **Sideloadly** → podłącz iPhone + „Zaufaj" → przeciągnij `.ipa` → wpisz Apple ID → Start → Done. Potem na iPhonie: Ustawienia → VPN i zarządzanie urządzeniami → Zaufaj; Ustawienia → Prywatność → Tryb programisty → włącz + restart.

---

## Najważniejsze
- **Darmowo + bez wysyłania pliku** → DROGA A (telefon przy Macu). Najpewniejsza.
- **Plik `.ipa` zdalnie** → DROGA B, ale wymaga **płatnego** Apple Developer (darmowe konto nie wyeksportuje `.ipa` przez EAS).
- Adres backendu i wszystko inne jest już skonfigurowane — nic nie zmieniaj w kodzie.
