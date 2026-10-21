// Field errors under form fields: red border, message, aria-invalid / aria-describedby.

export function effacerErreurs(form) {
  form.querySelectorAll('.field-error[data-genere]').forEach((p) => p.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((champ) => {
    champ.removeAttribute('aria-invalid');
    const decrit = (champ.getAttribute('aria-describedby') || '')
      .split(' ')
      .filter((id) => id && !id.endsWith('-erreur'))
      .join(' ');
    if (decrit) champ.setAttribute('aria-describedby', decrit);
    else champ.removeAttribute('aria-describedby');
  });
}

// details: [{ champ, probleme }]. Returns true when at least one field matched.
export function afficherErreurs(form, details = [], alias = {}) {
  let trouve = false;
  for (const { champ, probleme } of details) {
    const champForm = form.elements.namedItem(alias[champ] || champ);
    if (!champForm || !champForm.id || champForm.getAttribute('aria-invalid') === 'true') continue;
    const p = document.createElement('p');
    p.className = 'field-error';
    p.id = `${champForm.id}-erreur`;
    p.dataset.genere = '';
    p.textContent = probleme;
    champForm.closest('.field').append(p);
    champForm.setAttribute('aria-invalid', 'true');
    const decrit = champForm.getAttribute('aria-describedby');
    champForm.setAttribute('aria-describedby', decrit ? `${decrit} ${p.id}` : p.id);
    trouve = true;
  }
  const premier = form.querySelector('[aria-invalid="true"]');
  if (premier) premier.focus();
  return trouve;
}

// Disables the submit button while the request runs.
export async function pendantEnvoi(form, action) {
  const bouton = form.querySelector('[type="submit"]');
  if (bouton) bouton.disabled = true;
  try {
    return await action();
  } finally {
    if (bouton) bouton.disabled = false;
  }
}

export const valeur = (form, nom) => (form.elements.namedItem(nom)?.value || '').trim();
