'use strict';

const menuButton = document.querySelector('.menu-button');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Menüyü aç');
  mobileNav.hidden = true;
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  mobileNav.hidden = !open;
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});
document.addEventListener('click', event => {
  if (!mobileNav.hidden && !mobileNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
});
window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);

const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const roomInput = document.querySelector('#room-size');
const ordersInput = document.querySelector('#orders');
const storageRate = document.querySelector('#storage-rate');
const orderRate = document.querySelector('#order-rate');
function calculate() {
  const valid = [storageRate, orderRate].every(input => input.value !== '' && input.checkValidity());
  const room = Number(roomInput.value);
  const orders = Number(ordersInput.value);
  document.querySelector('#room-output').textContent = money.format(room);
  document.querySelector('#orders-output').textContent = money.format(orders);
  for (const input of [roomInput, ordersInput]) {
    const fraction = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty('--range', `${fraction * 100}%`);
  }
  if (!valid) {
    document.querySelector('#storage-total').textContent = '—';
    document.querySelector('#order-total').textContent = '—';
    document.querySelector('#monthly-total').textContent = '—';
    return;
  }
  const storage = room * Number(storageRate.value);
  const fulfillment = orders * Number(orderRate.value);
  document.querySelector('#storage-total').textContent = `${money.format(storage)} ₺`;
  document.querySelector('#order-total').textContent = `${money.format(fulfillment)} ₺`;
  const amount = document.querySelector('#monthly-total');
  amount.textContent = `${money.format(storage + fulfillment)} `;
  const currency = document.createElement('small');
  currency.textContent = '₺';
  amount.append(currency);
}
[roomInput, ordersInput, storageRate, orderRate].forEach(input => input.addEventListener('input', calculate));
calculate();

const dialog = document.querySelector('#merchant-dialog');
const merchantForm = document.querySelector('#merchant-form');
const merchantDraft = document.querySelector('#merchant-draft');
let previousFocus;
document.querySelectorAll('[data-open-merchant]').forEach(button => button.addEventListener('click', () => {
  previousFocus = document.activeElement;
  dialog.showModal();
  document.body.classList.add('dialog-open');
  document.querySelector('#merchant-name').focus();
}));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); previousFocus?.focus(); });
merchantForm.addEventListener('input', () => {
  document.querySelector('#merchant-fallback').hidden = true;
  document.querySelector('#copy-status').textContent = '';
  merchantForm.querySelectorAll('input, textarea').forEach(input => input.setCustomValidity(''));
});
merchantForm.addEventListener('submit', event => {
  event.preventDefault();
  const brand = document.querySelector('#merchant-name');
  const city = document.querySelector('#merchant-city');
  const needs = document.querySelector('#merchant-needs');
  for (const input of [brand, city, needs]) {
    input.value = input.value.trim();
    input.setCustomValidity(input.value ? '' : 'Lütfen bu alanı doldurun.');
  }
  if (!merchantForm.reportValidity()) return;
  const orders = document.querySelector('#merchant-orders').value;
  const body = `Merhaba Odağı ekibi,\n\nMarkamız için pilot programı görüşmek istiyoruz.\n\nMarka: ${brand.value}\nŞehir: ${city.value}\nAylık sipariş: ${orders}\nÜrünler ve ihtiyacımız: ${needs.value}\n\nUygun iş birliği koşullarını konuşmak isteriz.\nTeşekkürler.`;
  merchantDraft.value = body;
  document.querySelector('#merchant-fallback').hidden = false;
  window.location.href = `mailto:info@intiba.co.uk?subject=${encodeURIComponent('Odağı pilot talebi — ' + brand.value)}&body=${encodeURIComponent(body)}`;
});
document.querySelector('#copy-draft').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(merchantDraft.value);
    status.textContent = 'Taslak kopyalandı.';
  } catch {
    merchantDraft.focus();
    merchantDraft.select();
    status.textContent = 'Metin seçildi. Kopyalamak için Ctrl+C veya ⌘C kullanın.';
  }
});

function openLinkedDetails() {
  if (window.location.hash === '#basvuru-bilgisi') document.querySelector('#basvuru-bilgisi').open = true;
}
window.addEventListener('hashchange', openLinkedDetails);
document.querySelectorAll('a[href="#basvuru-bilgisi"]').forEach(link => link.addEventListener('click', () => { document.querySelector('#basvuru-bilgisi').open = true; }));
openLinkedDetails();
