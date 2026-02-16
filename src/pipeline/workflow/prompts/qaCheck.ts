export const QA_CHECK_PROMPT = `Sen bir kalite kontrol uzmanisin. Asagidaki icerigi kalite standartlarina gore degerlendir.

Icerik Tipi: {{contentType}}
Icerik: {{content}}
Marka Rehberi: {{brandGuidelines}}

Asagidaki formatta kalite degerlendirmesi yap:
{
  "overallScore": 85,
  "passed": true,
  "categories": {
    "spelling": { "score": 90, "issues": [] },
    "grammar": { "score": 85, "issues": [] },
    "brandConsistency": { "score": 80, "issues": [] },
    "factAccuracy": { "score": 90, "issues": [] }
  },
  "suggestions": ["Oneri 1"],
  "summary": "Genel degerlendirme ozeti"
}`;
