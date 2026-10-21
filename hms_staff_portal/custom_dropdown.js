/**
 * CareBridge HMS Staff Portal - Custom Dropdown Component
 * 
 * Replaces native OS <select> popups with a cleanly-styled, natural-height
 * dropdown menu that eliminates excessive whitespace, padding glitches,
 * and OS picker sizing discrepancies in Chromium on Windows.
 * 
 * Fully preserves:
 * - document.getElementById(selectId).value
 * - document.getElementById(selectId).options
 * - select.onchange and addEventListener('change')
 * - HTML5 form submission and validation
 */

(function () {
  'use strict';

  function attachCustomDropdown(select) {
    if (!select || select.dataset.customSelectInit === 'true') return;
    if (select.multiple || select.size > 1) return;

    select.dataset.customSelectInit = 'true';

    // 1. Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    if (select.id) wrapper.setAttribute('data-select-id', select.id);
    if (select.style.flex) wrapper.style.flex = select.style.flex;
    if (select.style.display === 'none' || select.hidden) wrapper.style.display = 'none';

    // Replace select position with wrapper, and put select inside wrapper
    if (select.parentNode) {
      select.parentNode.insertBefore(wrapper, select);
    }
    wrapper.appendChild(select);
    select.classList.add('custom-select-hidden');

    // 2. Create Trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'custom-select-label';
    trigger.appendChild(label);

    const arrow = document.createElement('i');
    arrow.className = 'fa-solid fa-chevron-down custom-select-arrow';
    trigger.appendChild(arrow);

    wrapper.appendChild(trigger);

    // 3. Create Dropdown Menu
    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.style.display = 'none';
    wrapper.appendChild(menu);

    let highlightedIndex = -1;

    // Helper: Render custom options from current <select> options
    function renderOptions() {
      menu.innerHTML = '';
      const opts = Array.from(select.options);
      let selectedText = '';
      let isPlaceholder = false;

      opts.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'custom-select-option';
        item.dataset.value = opt.value;
        item.dataset.index = idx;
        item.setAttribute('role', 'option');
        item.textContent = opt.textContent || opt.text || '';

        const isCurrent = (select.selectedIndex === idx) || (select.value === opt.value && opt.value !== '');

        if (opt.value === '' || opt.disabled) {
          item.classList.add('is-placeholder');
          if (opt.disabled) item.classList.add('is-disabled');
        }

        if (opt.hidden || opt.style.display === 'none') {
          item.style.display = 'none';
        }

        if (opt.classList.contains('room-available') || opt.style.color === '#16a34a' || opt.style.color === 'rgb(22, 163, 74)') {
          item.classList.add('room-available');
          item.style.color = '#16a34a';
          item.style.fontWeight = '700';
        }

        if (isCurrent) {
          item.classList.add('is-selected');
          selectedText = item.textContent;
          isPlaceholder = (opt.value === '');
        }

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (opt.disabled || opt.hidden || opt.style.display === 'none') return;
          select.value = opt.value;
          select.selectedIndex = idx;
          updateSelectedDisplay();
          closeMenu();
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        menu.appendChild(item);
      });

      // Update trigger label
      const currentOpt = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
      if (currentOpt) {
        selectedText = currentOpt.textContent || currentOpt.text || '';
        isPlaceholder = (currentOpt.value === '');
      }

      label.textContent = selectedText || (opts[0] ? opts[0].textContent : 'Select...');
      if (isPlaceholder || !select.value) {
        label.classList.add('is-placeholder');
      } else {
        label.classList.remove('is-placeholder');
      }

      // Sync disabled state
      if (select.disabled) {
        trigger.classList.add('is-disabled');
      } else {
        trigger.classList.remove('is-disabled');
      }
    }

    // Helper: Update selection highlight without re-creating all DOM nodes
    function updateSelectedDisplay() {
      const opts = Array.from(select.options);
      let selectedText = '';
      let isPlaceholder = false;

      const items = menu.querySelectorAll('.custom-select-option');
      items.forEach((item, idx) => {
        const opt = opts[idx];
        if (!opt) return;
        if (opt.hidden || opt.style.display === 'none') {
          item.style.display = 'none';
        } else {
          item.style.display = '';
        }
        item.textContent = opt.textContent || opt.text || '';
        item.classList.toggle('is-disabled', !!opt.disabled);

        const isCurrent = (select.selectedIndex === idx) || (select.value === opt.value && opt.value !== '');
        if (isCurrent) {
          item.classList.add('is-selected');
          selectedText = opt.textContent || opt.text || '';
          isPlaceholder = (opt.value === '');
        } else {
          item.classList.remove('is-selected');
        }
      });

      label.textContent = selectedText || (opts[0] ? opts[0].textContent : 'Select...');
      if (isPlaceholder || !select.value) {
        label.classList.add('is-placeholder');
      } else {
        label.classList.remove('is-placeholder');
      }

      if (select.disabled) {
        trigger.classList.add('is-disabled');
      } else {
        trigger.classList.remove('is-disabled');
      }
    }

    function openMenu() {
      if (select.disabled) return;
      // Close other open dropdowns
      document.querySelectorAll('.custom-select-wrapper.is-open').forEach(w => {
        if (w !== wrapper) {
          w.classList.remove('is-open');
          const m = w.querySelector('.custom-select-menu');
          if (m) m.style.display = 'none';
        }
      });

      wrapper.classList.add('is-open');
      menu.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');

      // Scroll to selected item
      const selectedItem = menu.querySelector('.custom-select-option.is-selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }

    function closeMenu() {
      wrapper.classList.remove('is-open');
      menu.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
      highlightedIndex = -1;
    }

    function toggleMenu() {
      if (wrapper.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (select.disabled) return;
      toggleMenu();
    });

    // Keyboard navigation
    trigger.addEventListener('keydown', (e) => {
      if (select.disabled) return;
      const items = Array.from(menu.querySelectorAll('.custom-select-option:not(.is-disabled):not([style*="display: none"])'));

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!wrapper.classList.contains('is-open')) {
          openMenu();
          return;
        }
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
          highlightedIndex = (highlightedIndex + 1) % items.length;
        } else {
          highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
        }

        items.forEach((it, idx) => {
          it.classList.toggle('is-highlighted', idx === highlightedIndex);
        });
        if (items[highlightedIndex]) {
          items[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!wrapper.classList.contains('is-open')) {
          openMenu();
        } else if (highlightedIndex >= 0 && items[highlightedIndex]) {
          items[highlightedIndex].click();
        }
      } else if (e.key === 'Escape') {
        closeMenu();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const char = e.key.toLowerCase();
        const matchIdx = items.findIndex(it => it.textContent.trim().toLowerCase().startsWith(char));
        if (matchIdx >= 0) {
          highlightedIndex = matchIdx;
          items.forEach((it, idx) => {
            it.classList.toggle('is-highlighted', idx === highlightedIndex);
          });
          if (items[highlightedIndex]) {
            items[highlightedIndex].scrollIntoView({ block: 'nearest' });
          }
          if (!wrapper.classList.contains('is-open')) {
            items[highlightedIndex].click();
          }
        }
      }
    });

    // Watch for programmatic changes on select.value
    let lastVal = select.value;
    const observerTimer = setInterval(() => {
      if (select.value !== lastVal) {
        lastVal = select.value;
        updateSelectedDisplay();
      }
      if (select.disabled !== trigger.classList.contains('is-disabled')) {
        if (select.disabled) trigger.classList.add('is-disabled');
        else trigger.classList.remove('is-disabled');
      }
      const isHidden = (select.style.display === 'none' || select.hidden);
      if (isHidden && wrapper.style.display !== 'none') {
        wrapper.style.display = 'none';
      } else if (!isHidden && wrapper.style.display === 'none') {
        wrapper.style.display = '';
      }
    }, 250);

    select.addEventListener('change', () => {
      lastVal = select.value;
      updateSelectedDisplay();
    });

    // Expose programmatic re-render helper on select element
    select._renderCustomDropdown = renderOptions;

    // Observe child options modifications (e.g. syncSelectOptions calls)
    const observer = new MutationObserver(() => {
      renderOptions();
    });
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'hidden', 'style'] });

    // Initial render
    renderOptions();
  }

  // Global click outside to close all open dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
      document.querySelectorAll('.custom-select-wrapper.is-open').forEach(w => {
        w.classList.remove('is-open');
        const m = w.querySelector('.custom-select-menu');
        if (m) m.style.display = 'none';
      });
    }
  });

  // Global escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.custom-select-wrapper.is-open').forEach(w => {
        w.classList.remove('is-open');
        const m = w.querySelector('.custom-select-menu');
        if (m) m.style.display = 'none';
      });
    }
  });

  // Initialize all select elements on page
  function initCustomDropdowns() {
    const selects = document.querySelectorAll('select.form-control, select');
    selects.forEach(attachCustomDropdown);
  }

  // Expose globally
  window.attachCustomDropdown = attachCustomDropdown;
  window.initCustomDropdowns = initCustomDropdowns;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomDropdowns);
  } else {
    setTimeout(initCustomDropdowns, 50);
  }

  // Auto-init periodically or when switching views
  setInterval(initCustomDropdowns, 1500);
})();
