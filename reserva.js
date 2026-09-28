(() => {
  // Pedido de reserva: monta a mensagem e abre o WhatsApp (o site não guarda os dados)
  const WHATSAPP = '5531980300485';
  const form = document.getElementById('reserva-form');
  const error = form.querySelector('.form-error');
  const done = form.querySelector('.form-done');
  const fallback = form.querySelector('[data-wa-fallback]');
  const date = form.elements.data;

  // não permite datas passadas
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  date.min = today.toISOString().slice(0, 10);

  const labelOf = (el) => form.querySelector(`label[for="${el.id}"]`)?.childNodes[0].textContent.trim() || 'campo';
  const toBR = (iso) => iso.split('-').reverse().join('/');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
    if (invalid) {
      error.textContent = invalid.type === 'checkbox'
        ? 'Confirme que está ciente de que a reserva depende da confirmação da unidade.'
        : `Preencha o campo "${labelOf(invalid)}".`;
      error.hidden = false;
      invalid.focus();
      return;
    }
    error.hidden = true;

    const f = form.elements;
    const opt = (label, value) => (value ? `${label}: ${value}` : null);   // campo opcional vazio não entra
    const lines = [
      'Olá! Gostaria de solicitar uma reserva de vaga antecipada na Atlas Park Casa Vereda.',
      '',
      `Nome: ${f.nome.value.trim()}`,
      `Telefone: ${f.telefone.value.trim()}`,
      opt('E-mail', f.email.value.trim()),
      `Data do evento: ${toBR(f.data.value)}`,
      `Chegada prevista: ${f.hora.value}`,
      opt('Evento', f.evento.value.trim()),
      opt('Placa', f.placa.value.trim().toUpperCase()),
      opt('Observações', f.obs.value.trim()),
    ].filter((l) => l !== null);
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;

    fallback.href = url;
    done.hidden = false;
    window.open(url, '_blank', 'noopener');
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
