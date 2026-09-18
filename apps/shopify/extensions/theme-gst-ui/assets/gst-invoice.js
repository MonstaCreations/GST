/* GST Engine — cart-page GST capture. Vanilla JS, no dependencies.
 * Flow: format+checksum (client pre-check) -> POST /apps/gst/verify (App Proxy)
 * -> render state -> on confirm, write cart attributes so the data reaches the order.
 * The server re-validates authoritatively; this is only UX. */
(function () {
  'use strict';

  var GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  var CODES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function checkDigit(first14) {
    var factor = 2,
      sum = 0,
      mod = CODES.length;
    for (var i = first14.length - 1; i >= 0; i--) {
      var cp = CODES.indexOf(first14.charAt(i));
      if (cp < 0) return '';
      var add = factor * cp;
      factor = factor === 2 ? 1 : 2;
      add = Math.floor(add / mod) + (add % mod);
      sum += add;
    }
    return CODES.charAt((mod - (sum % mod)) % mod);
  }

  function isValidGstin(g) {
    if (!GSTIN_RE.test(g)) return false;
    return checkDigit(g.slice(0, 14)) === g.charAt(14);
  }

  function setStatus(el, msg, tone) {
    el.textContent = msg || '';
    el.className = 'gst-hint' + (tone ? ' gst-hint--' + tone : '');
  }

  function init(root) {
    var verifyUrl = root.getAttribute('data-verify-url');
    var toggle = root.querySelector('[data-gst-toggle]');
    var panel = root.querySelector('[data-gst-panel]');
    var input = root.querySelector('[data-gst-input]');
    var verifyBtn = root.querySelector('[data-gst-verify]');
    var status = root.querySelector('[data-gst-status]');
    var result = root.querySelector('[data-gst-result]');
    var useBtn = root.querySelector('[data-gst-use]');
    var applied = root.querySelector('[data-gst-applied]');
    var current = null;

    function showPanel() {
      panel.hidden = !toggle.checked;
    }
    toggle.addEventListener('change', showPanel);
    showPanel();

    input.addEventListener('input', function () {
      input.value = input.value.toUpperCase().replace(/\s+/g, '');
      result.hidden = true;
      applied.hidden = true;
      current = null;
      setStatus(status, '');
    });

    verifyBtn.addEventListener('click', function () {
      var gstin = (input.value || '').trim().toUpperCase();
      if (!gstin) {
        setStatus(status, 'Enter a GSTIN.', 'warn');
        return;
      }
      if (!isValidGstin(gstin)) {
        setStatus(status, "That GSTIN doesn't look valid.", 'error');
        return;
      }

      setStatus(status, 'Verifying…', 'muted');
      verifyBtn.disabled = true;

      fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ gstin: gstin }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (out) {
          verifyBtn.disabled = false;
          switch (out && out.kind) {
            case 'verified':
              current = out.result;
              root.querySelector('[data-gst-legal-name]').textContent = out.result.legalName || '';
              root.querySelector('[data-gst-address]').textContent =
                out.result.registeredAddress || '';
              root.querySelector('[data-gst-city]').textContent = out.result.city || '';
              root.querySelector('[data-gst-state]').textContent = out.result.state || '';
              result.hidden = false;
              setStatus(status, '');
              break;
            case 'inactive':
              setStatus(status, 'This GSTIN is not active.', 'error');
              break;
            case 'not_found':
              setStatus(status, 'GSTIN not found.', 'error');
              break;
            case 'invalid':
              setStatus(status, 'Invalid GSTIN.', 'error');
              break;
            case 'unavailable':
            default:
              setStatus(
                status,
                "Verification unavailable — you can still checkout; we'll add GST to your invoice.",
                'warn',
              );
          }
        })
        .catch(function () {
          verifyBtn.disabled = false;
          setStatus(status, 'Verification unavailable — you can still checkout.', 'warn');
        });
    });

    useBtn.addEventListener('click', function () {
      if (!current) return;
      useBtn.disabled = true;
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            gst_invoice: 'true',
            gst_gstin: current.gstin,
            gst_legal_name: current.legalName,
            gst_registered_address: current.registeredAddress,
            gst_city: current.city,
            gst_state: current.state,
            gst_state_code: current.stateCode,
          },
        }),
      })
        .then(function () {
          applied.hidden = false;
          useBtn.disabled = false;
        })
        .catch(function () {
          useBtn.disabled = false;
          setStatus(status, "Couldn't attach GST details. Please try again.", 'error');
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var roots = document.querySelectorAll('[data-gst-app]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  });
})();
