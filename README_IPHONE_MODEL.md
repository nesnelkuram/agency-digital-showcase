# iPhone 14 Pro Max 3D Model Kurulumu

## Model İndirme

1. Şu linke gidin: https://sketchfab.com/3d-models/iphone-14-pro-max-95f11f5a06604c8b9fd44046ae52a9cc
2. Ücretsiz Sketchfab hesabı oluşturun veya giriş yapın
3. "Download 3D Model" butonuna tıklayın
4. Format olarak "GLTF" seçin (veya "Autoconverted format (glTF)" seçeneği)
5. İndirilen zip dosyasını açın

## Projeye Ekleme

1. İndirilen dosyayı çıkarın
2. `.glb` veya `.gltf` dosyasını bulun (genelde `scene.glb` veya `scene.gltf` adında olur)
3. Dosyayı `iphone14promax.glb` olarak yeniden adlandırın
4. Bu dosyayı projenizin `/public/models/` klasörüne kopyalayın

## Model Kontrolü

Model yüklendikten sonra, tarayıcıda şu URL'i kontrol edin:
http://localhost:3000/models/iphone14promax.glb

Eğer dosya doğru yüklendiyse, indirme başlamalı.

## Alternatif: ModernPhone Kullanımı

Eğer model dosyasını indiremezseniz veya sorun yaşarsanız, `AnimatedPhone.tsx` dosyasında `IPhone3D` yerine tekrar `ModernPhone` kullanabilirsiniz.