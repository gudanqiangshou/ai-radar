// src/render/web/js/drag.js
function initCore30Drag() {
  const container = document.getElementById('core30');
  let dragging = null;

  container.querySelectorAll('.stock-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragging = card;
      card.style.opacity = 0.5;
    });
    card.addEventListener('dragend', e => {
      card.style.opacity = 1;
      saveOrder();
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragging && dragging !== card) {
        const rect = card.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;
        if (after) card.parentNode.insertBefore(dragging, card.nextSibling);
        else card.parentNode.insertBefore(dragging, card);
      }
    });
  });
}

function saveOrder() {
  const order = Array.from(document.querySelectorAll('#core30 .stock-card'))
    .map(el => el.dataset.ticker);
  localStorage.setItem('core30_order_v1', JSON.stringify(order));
}

function resetOrder() {
  localStorage.removeItem('core30_order_v1');
  location.reload();
}
