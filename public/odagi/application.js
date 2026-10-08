'use strict';

(() => {
  const quickForm = document.querySelector('#quick-application');
  const continueButton = document.querySelector('#continue-application');
  const wizard = document.querySelector('#application-wizard');
  const consentText = 'Başvurumun değerlendirilmesi için paylaştığım bilgilerin İntiba tarafından kaydedilmesini ve bu başvuru hakkında e-posta ile iletişime geçilmesini kabul ediyorum.';
  const yesNo = [['yes', 'Evet'], ['no', 'Hayır']];
  const choice = (name, legend, options, multiple = false) => `<fieldset class="wizard-choice${multiple ? ' wizard-multiple' : ''}" data-choice="${name}"><legend>${legend}</legend><div>${options.map(([value, label]) => `<label><input type="${multiple ? 'checkbox' : 'radio'}" name="${name}" value="${value}" ${multiple ? '' : 'required'}><span>${label}</span></label>`).join('')}</div>${multiple ? '<span class="choice-help">Uygun olanları seçin.</span>' : ''}</fieldset>`;
  wizard.innerHTML = `
    <div class="wizard-heading"><div><span class="mini-label">BİRKAÇ KÜÇÜK ADIMDA TANIŞALIM</span><h3>Odanızın hikâyesini dinleyelim.</h3></div><span id="wizard-location" class="wizard-location"></span></div>
    <ol class="wizard-progress" aria-label="Başvuru adımları"><li><span>01</span>Siz</li><li><span>02</span>Odanız</li><li><span>03</span>Çalışma planı</li><li><span>04</span>Son kontrol</li></ol>
    <form id="application-form" novalidate>
      <fieldset class="wizard-step" data-step="0"><legend class="sr-only">İletişim bilgileriniz</legend>
        <h4 tabindex="-1">Önce sizi tanıyalım.</h4><p class="wizard-intro">Uygun bir iş birliği olduğunda sizinle iletişime geçebilmemiz için.</p>
        <div class="wizard-fields"><label>Ad soyad<input name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Adınız ve soyadınız"></label><label>E-posta<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="ornek@eposta.com"></label><label>Mahalle<input name="neighborhood" required minlength="2" maxlength="100" placeholder="Odanızın bulunduğu mahalle"></label><label>Mesleğiniz<input name="occupation" required minlength="2" maxlength="120" placeholder="Mevcut işiniz veya uğraşınız"></label></div>
        ${choice('employed', 'Sigortalı olarak çalışıyor musunuz?', yesNo)}
        ${choice('company', 'Fatura kesebileceğiniz bir şirketiniz var mı?', [['exists', 'Evet, şirketim var'], ['none', 'Hayır, şirketim yok'], ['considering', 'İş birliği netleşirse değerlendirebilirim']])}
      </fieldset>
      <fieldset class="wizard-step" data-step="1" hidden disabled><legend class="sr-only">Odanızın koşulları</legend>
        <h4 tabindex="-1">Nasıl bir alanınız var?</h4><p class="wizard-intro">Ürünlere uygun ve düzenli bir çalışma alanı planlayalım.</p>
        ${choice('ownsSpace', 'Sunacağınız alanın mülkiyeti size mi ait?', yesNo)}
        ${choice('petSmoke', 'Evcil hayvan veya sigara durumu', [['pets', 'Evcil hayvan var'], ['smoking', 'Sigara kullanılıyor'], ['clear', 'Hiçbiri yok']], true)}
        ${choice('roomConditions', 'Odada aşağıdaki durumlardan biri var mı?', [['damp', 'Nem / rutubet var'], ['sunlight', 'Yoğun güneş alıyor'], ['clear', 'Hiçbiri yok']], true)}
        ${choice('packingSpace', 'Paketleme masası ve ambalajlar için alan var mı?', yesNo)}
        <label class="wizard-wide-label">Alan hakkında biraz daha bilgi<textarea name="roomInfo" rows="3" required minlength="5" maxlength="2000" placeholder="Odanın düzeni, raflar, erişim veya paylaşmak istediğiniz diğer bilgiler..."></textarea></label>
      </fieldset>
      <fieldset class="wizard-step" data-step="2" hidden disabled><legend class="sr-only">Çalışma planınız</legend>
        <h4 tabindex="-1">Gününüzde nasıl yer açabiliriz?</h4><p class="wizard-intro">Uygunluğunuzu ve beklentilerinizi birlikte değerlendirelim.</p>
        ${choice('daytimeAvailable', 'Gün içinde paketleme ve kargo işiyle ilgilenebilecek biri var mı?', yesNo)}
        <label class="wizard-wide-label">Yakınınızdaki kargo şubeleri ve teslim imkânınız<textarea name="couriers" rows="3" required minlength="5" maxlength="1500" placeholder="Hangi şubelere ulaşabiliyorsunuz? Paketleri teslim edebilir misiniz?"></textarea></label>
        ${choice('investment', 'İş birliği koşulları netleşirse raf, yazıcı gibi ekipmanlara yatırım yapmayı değerlendirir misiniz?', yesNo)}
        <p class="wizard-small-note">Başvuru için ekipman almanız gerekmez. İhtiyaç ve maliyetler iş birliği öncesinde konuşulur.</p>
        ${choice('income', 'Aylık gelir beklentiniz hangi aralıkta?', [['5-25', '5.000 – 25.000 ₺'], ['25-40', '25.000 – 40.000 ₺'], ['40-100', '40.000 – 100.000 ₺'], ['100+', '100.000 ₺ üzeri']])}
      </fieldset>
      <fieldset class="wizard-step" data-step="3" hidden disabled><legend class="sr-only">Başvurunuzu kontrol edin</legend>
        <h4 tabindex="-1">Son bir göz atalım.</h4><p class="wizard-intro">Bilgileriniz doğruysa başvurunuzu buradan tamamlayabilirsiniz.</p>
        <div id="application-review" class="application-review"></div>
        <div class="application-notice"><strong>Başvuru ve veri kullanımı</strong><p>Paylaştığınız bilgiler, başvurunuzu değerlendirmek ve sizinle bu başvuru hakkında iletişim kurmak için İntiba başvuru sisteminde tutulur. Kayıtlara yalnızca yetkili İntiba yöneticileri erişebilir. Bilgilerinizi görmek, düzeltmek veya silinmesini istemek için <a href="mailto:info@intiba.co.uk">info@intiba.co.uk</a> adresine yazabilirsiniz.</p><p>Başvuru, sipariş veya gelir garantisi değildir. Bu onay pazarlama izni içermez.</p></div>
        <label class="application-consent"><input type="checkbox" name="applicationConsent" required><span>${consentText}</span></label>
      </fieldset>
      <div class="application-trap" aria-hidden="true"><label>Web sitesi<input name="website" tabindex="-1" autocomplete="off" maxlength="200"></label></div>
      <p id="application-error" class="application-error" role="alert" hidden></p>
      <div class="wizard-actions"><button type="button" class="button button-outline" id="application-back">Geri</button><span id="application-step-count">1 / 4</span><button type="submit" class="button button-green" id="application-next"><span>Devam et</span><svg class="icon"><use href="#arrow"/></svg></button></div>
    </form>
    <div id="application-success" class="application-success" role="status" tabindex="-1" hidden><span class="success-icon"><svg class="icon"><use href="#check"/></svg></span><span class="mini-label">YENİ BİR BAŞLANGICIN İLK ADIMI</span><h3>Başvurunuz bize ulaştı.</h3><p>Odanız ve çalışma planınız değerlendirmeye alındı. Uygun bir eşleşme oluşursa belirttiğiniz e-posta adresinden sizinle iletişime geçebiliriz.</p><div class="application-reference"><span>Başvuru numaranız</span><strong id="application-reference"></strong></div><p class="wizard-small-note">Numaranızı saklayın. Sorularınız için <a href="mailto:info@intiba.co.uk">info@intiba.co.uk</a> adresine yazabilirsiniz.</p><a class="text-link" href="#nasil-calisir">İş birliği modelini inceleyin <svg class="icon"><use href="#arrow"/></svg></a></div>`;

  const form = document.querySelector('#application-form');
  const steps = [...form.querySelectorAll('.wizard-step')];
  const progress = [...wizard.querySelectorAll('.wizard-progress li')];
  const back = document.querySelector('#application-back');
  const next = document.querySelector('#application-next');
  const errorBox = document.querySelector('#application-error');
  let currentStep = 0, started = false, sending = false, completed = false, prepared;
  const fields = {
    name: 'Ad soyad', email: 'E-posta', city: 'İl / şehir', district: 'İlçe', neighborhood: 'Mahalle', area: 'Alan (m²)',
    occupation: 'Meslek', employed: 'Sigortalı çalışma', ownsSpace: 'Mülkiyet', company: 'Faturalama',
    petSmoke: 'Evcil hayvan / sigara', roomConditions: 'Oda koşulları', packingSpace: 'Paketleme alanı', roomInfo: 'Alan hakkında',
    daytimeAvailable: 'Gün içinde uygun kişi', couriers: 'Kargo erişimi', investment: 'Ekipman yatırımı', income: 'Gelir beklentisi',
  };
  const values = {yes:'Evet',no:'Hayır',exists:'Şirketim var',none:'Şirketim yok',considering:'İş birliği netleşirse değerlendirebilirim',pets:'Evcil hayvan var',smoking:'Sigara kullanılıyor',clear:'Hiçbiri yok',damp:'Nem / rutubet var',sunlight:'Yoğun güneş alıyor','5-25':'5.000 – 25.000 ₺','25-40':'25.000 – 40.000 ₺','40-100':'40.000 – 100.000 ₺','100+':'100.000 ₺ üzeri'};
  const read = name => {
    const inputs = [...form.querySelectorAll(`[name="${name}"]`)];
    if (inputs[0]?.type === 'radio') return inputs.find(input => input.checked)?.value || '';
    if (inputs[0]?.type === 'checkbox') return inputs.filter(input => input.checked).map(input => input.value);
    return inputs[0]?.value.trim() || '';
  };
  const getAnswers = () => ({
    city: document.querySelector('#city').value.trim(), district: document.querySelector('#district').value.trim(), area: Number(document.querySelector('#area').value),
    ...Object.fromEntries(Object.keys(fields).filter(key => !['city','district','area'].includes(key)).map(key => [key, read(key)])),
    applicationConsent: form.querySelector('[name="applicationConsent"]').checked,
    website: form.querySelector('[name="website"]').value,
  });
  function review() {
    const target = document.querySelector('#application-review');
    target.replaceChildren();
    const answers = getAnswers();
    for (const [name, label] of Object.entries(fields)) {
      const row = document.createElement('div');
      const title = document.createElement('span'); title.textContent = label;
      const value = document.createElement('strong');
      value.textContent = Array.isArray(answers[name]) ? answers[name].map(item => values[item] || item).join(', ') : values[answers[name]] || String(answers[name]);
      row.append(title, value); target.append(row);
    }
  }
  function setStep(index, focus = true) {
    currentStep = index;
    steps.forEach((step, i) => { step.hidden = i !== index; step.disabled = i !== index; });
    progress.forEach((item, i) => { item.classList.toggle('is-complete', i < index); if (i === index) item.setAttribute('aria-current','step'); else item.removeAttribute('aria-current'); });
    back.disabled = index === 0;
    document.querySelector('#application-step-count').textContent = `${index + 1} / 4`;
    next.querySelector('span').textContent = index === 3 ? 'Başvurumu gönder' : 'Devam et';
    errorBox.hidden = true;
    if (index === 3) review();
    if (focus) { steps[index].querySelector('h4').focus({preventScroll:true}); steps[index].scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); }
  }
  function validateQuick() {
    for (const input of quickForm.querySelectorAll('input:not([type="number"])')) {
      input.value = input.value.trim();
      input.setCustomValidity(input.value.length < 2 ? 'Lütfen en az iki karakter girin.' : '');
    }
    return quickForm.reportValidity();
  }
  function validateStep(index) {
    const step = steps[index];
    for (const input of step.querySelectorAll('input[type="text"], input:not([type]), input[type="email"], textarea')) {
      input.value = input.value.trim();
      input.setCustomValidity(input.minLength > 0 && input.value.length < input.minLength ? `Lütfen en az ${input.minLength} karakter girin.` : '');
    }
    for (const group of step.querySelectorAll('.wizard-multiple')) {
      const inputs = [...group.querySelectorAll('input')];
      inputs[0].setCustomValidity(inputs.some(input => input.checked) ? '' : 'Lütfen en az bir seçenek belirleyin.');
    }
    return [...step.querySelectorAll('input,textarea,select')].every(input => input.reportValidity());
  }
  quickForm.addEventListener('submit', event => {
    event.preventDefault();
    if (sending || completed || !validateQuick()) return;
    wizard.hidden = false;
    document.querySelector('#wizard-location').textContent = `${document.querySelector('#city').value} · ${document.querySelector('#district').value} · ${document.querySelector('#area').value} m²`;
    continueButton.setAttribute('aria-expanded','true');
    continueButton.querySelector('span').textContent = 'Bilgileri güncelle';
    setStep(started ? currentStep : 0);
    started = true;
  });
  quickForm.addEventListener('input', event => { event.target.setCustomValidity?.(''); if (currentStep === 3 && started) review(); });
  for (const group of form.querySelectorAll('.wizard-multiple')) group.addEventListener('change', event => {
    if (event.target.checked) {
      for (const input of group.querySelectorAll('input')) {
        if (input !== event.target && (input.value === 'clear' || event.target.value === 'clear')) input.checked = false;
      }
    }
    group.querySelector('input').setCustomValidity('');
  });
  form.addEventListener('input', () => { errorBox.hidden = true; });
  back.addEventListener('click', () => { if (!sending && currentStep > 0) setStep(currentStep - 1); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || completed || !validateStep(currentStep)) return;
    if (currentStep < 3) { setStep(currentStep + 1); return; }
    if (!validateQuick()) return;
    // Recheck every earlier step before sending, including browser-restored values.
    for (let i = 0; i < steps.length; i++) {
      steps[i].disabled = false;
      const invalid = [...steps[i].querySelectorAll('input,textarea')].some(input => !input.checkValidity());
      steps[i].disabled = i !== currentStep;
      if (invalid) { setStep(i); validateStep(i); return; }
    }
    const answers = getAnswers();
    const signature = JSON.stringify(answers);
    if (!prepared || prepared.signature !== signature) prepared = { signature, requestId: crypto.randomUUID() };
    sending = true;
    errorBox.hidden = true;
    next.disabled = back.disabled = continueButton.disabled = true;
    quickForm.querySelectorAll('input').forEach(input => input.readOnly = true);
    steps[currentStep].disabled = true;
    next.querySelector('span').textContent = 'Başvurunuz kaydediliyor…';
    form.setAttribute('aria-busy','true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/odagi/applications', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...answers, requestId:prepared.requestId}), signal:controller.signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.reference !== 'string' || !/^ODG-[A-F0-9]{12}$/.test(result.reference)) {
        if (response.status === 409) prepared = undefined;
        throw new Error(result.error || 'Başvurunun kaydedildiği doğrulanamadı. Lütfen tekrar deneyin.');
      }
      completed = true;
      form.hidden = true;
      wizard.querySelector('.wizard-heading').hidden = true;
      wizard.querySelector('.wizard-progress').hidden = true;
      continueButton.hidden = true;
      quickForm.querySelector('.form-note').textContent = 'Başvurunuz tamamlandı. Başvuru numaranızı aşağıda görebilirsiniz.';
      document.querySelector('#application-reference').textContent = result.reference;
      const success = document.querySelector('#application-success'); success.hidden = false;
      success.focus({preventScroll:true}); success.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      form.reset(); prepared = undefined;
    } catch (error) {
      errorBox.textContent = error.name === 'AbortError' ? 'Sunucudan sonuç alınamadı. Bilgileriniz burada duruyor; aynı başvuruyu yeniden deneyebilirsiniz.' : error.message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({block:'nearest'});
    } finally {
      clearTimeout(timeout); sending = false; form.removeAttribute('aria-busy');
      if (!completed) {
        steps[currentStep].disabled = false;
        next.disabled = back.disabled = continueButton.disabled = false;
        next.querySelector('span').textContent = 'Başvurumu gönder';
        quickForm.querySelectorAll('input').forEach(input => input.readOnly = false);
      }
    }
  });
  continueButton.disabled = false;
})();
