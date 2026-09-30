(() => {
  // Candidatura: monta o e-mail e abre o aplicativo de e-mail (o site não guarda os dados)
  // Destino por região: Minas Gerais e São Paulo -> beppe@; Brasília (DF) -> ouvidoria@
  const EMAIL_MG_SP = 'beppe@redeatlaspark.com.br';
  const EMAIL_DF = 'ouvidoria@redeatlaspark.com.br';
  const emailFor = (cidade) => (/\/DF$/.test(cidade) ? EMAIL_DF : EMAIL_MG_SP);
  const form = document.getElementById('trabalhe-form');
  const error = form.querySelector('.form-error');
  const done = form.querySelector('.form-done');
  let last = { to: EMAIL_MG_SP, subject: '', body: '' };

  const labelOf = (el) => {
    const l = form.querySelector(`label[for="${el.id}"]`);
    return l ? l.childNodes[0].textContent.trim() : 'campo';
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
    if (invalid) {
      if (invalid.type === 'checkbox') error.textContent = 'Marque a autorização de uso dos dados para enviar a candidatura.';
      else if (invalid.type === 'email' && invalid.value) error.textContent = 'Confira o e-mail: ele parece incompleto.';
      else error.textContent = `Preencha o campo "${labelOf(invalid)}".`;
      error.hidden = false;
      invalid.focus();
      return;
    }
    error.hidden = true;

    const f = form.elements;
    const val = (n) => f[n].value.trim();
    const turnos = [...form.querySelectorAll('input[name="turno"]:checked')].map((c) => c.value).join(', ');
    const opt = (label, value) => (value ? `${label}: ${value}` : null);   // campo opcional vazio não entra
    const subject = `Candidatura - ${val('area')} - ${val('nome')}`;
    const body = [
      'Olá! Gostaria de me candidatar para trabalhar na Rede Atlas Park.',
      '',
      `Nome: ${val('nome')}`,
      `Telefone: ${val('telefone')}`,
      `E-mail: ${val('email')}`,
      `Cidade: ${val('cidade')}`,
      `Área de interesse: ${val('area')}`,
      opt('Turnos disponíveis', turnos),
      opt('CNH', val('cnh')),
      opt('LinkedIn', val('linkedin')),
      val('mensagem') ? `\nSobre mim:\n${val('mensagem')}` : null,
      '',
      'Currículo em anexo.',
    ].filter((l) => l !== null).join('\n');

    const to = emailFor(val('cidade'));
    last = { to, subject, body };
    done.querySelector('[data-mail-to]').textContent = to;
    done.querySelector('[data-mail-subject]').textContent = `"${subject}"`;
    done.hidden = false;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // Plano B quando não há aplicativo de e-mail configurado
  done.querySelectorAll('[data-copy]').forEach((btn) => {
    const original = btn.textContent;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy === 'to' ? last.to : `Assunto: ${last.subject}\n\n${last.body}`;
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado!'; }
      catch { btn.textContent = 'Não foi possível copiar'; }
      setTimeout(() => { btn.textContent = original; }, 2000);
    });
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
