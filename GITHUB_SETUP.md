# GitHub Repository Kurulumu

## Otomatik Yöntem (GitHub CLI)

1. Terminal'de GitHub CLI'ya giriş yapın:
```bash
gh auth login
```

2. Repository'yi oluşturun ve push edin:
```bash
gh repo create agency-digital-showcase --public --source=. --remote=origin --push
```

## Manuel Yöntem

1. GitHub.com'a gidin
2. Sağ üstte "+" butonuna tıklayın ve "New repository" seçin
3. Repository adı: `agency-digital-showcase`
4. Public seçin
5. "Create repository" butonuna tıklayın
6. Terminal'de şu komutları çalıştırın:

```bash
git remote remove origin
git remote add origin https://github.com/intiba/agency-digital-showcase.git
git push -u origin main
```

## Repository URL'si
https://github.com/intiba/agency-digital-showcase

## Proje Özellikleri
- 3D telefon grid'i React Three Fiber ile
- Video texture'lar ve özel shader ile yuvarlatılmış köşeler
- Parallax scrolling efektleri
- Telefona tıklayınca zoom özelliği
- Kamera rotation kontrolleri
- Modern minimalist telefon tasarımı