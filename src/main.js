// Tab Switching Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('active');
  });
});

// Helper for loading state
function setLoading(btn, isLoading) {
  if (isLoading) {
    btn.classList.add('loading');
    btn.disabled = true;
    btn.dataset.originalText = btn.querySelector('span') ? btn.querySelector('span').innerText : btn.innerText;
    if (btn.querySelector('span')) {
      btn.querySelector('span').innerText = 'Processing...';
    } else {
      btn.innerText = 'Processing...';
    }
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    if (btn.querySelector('span')) {
      btn.querySelector('span').innerText = btn.dataset.originalText;
    } else {
      btn.innerText = btn.dataset.originalText;
    }
  }
}

// 1. Order Extractor
const extractBtn = document.getElementById('btn-extract');
extractBtn.addEventListener('click', async () => {
  const text = document.getElementById('invoice-text').value;
  if (!text) return alert("Please enter some text");
  
  setLoading(extractBtn, true);
  const resultArea = document.getElementById('extractor-result');
  resultArea.classList.add('hidden');
  
  try {
    const response = await fetch('/api/orders/extract/text', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-key'
      },
      body: JSON.stringify({ text })
    }).catch(err => { console.error(err); return null; }); // Ignore fetch error to use mock
    
    let data;
    if (response && response.ok) {
      data = await response.json();
    } else {
      // Mock Data if API is down
      await new Promise(r => setTimeout(r, 1000));
      data = {
        invoice_id: "INV-9921",
        items: [
          { name: "Wireless Keyboard", quantity: 2, price: 45.99, total: 91.98 },
          { name: "Ergonomic Mouse", quantity: 1, price: 29.99, total: 29.99 },
          { name: "USB-C Hub", quantity: 3, price: 15.50, total: 46.50 }
        ],
        grand_total: 168.47
      };
    }
    
    // Render
    const tbody = document.querySelector('#extractor-table tbody');
    tbody.innerHTML = '';
    
    // Map order lines to items for display
    const items = data.order?.lines || [];
    let grandTotal = 0;
    
    items.forEach(item => {
      // LLM doesn't extract price, so we mock it for the demo
      const price = 5.00; 
      const total = item.quantity * price;
      grandTotal += total;
      
      tbody.innerHTML += `
        <tr>
          <td>${item.product_description || item.name || 'Unknown'}</td>
          <td>${item.quantity}</td>
          <td>$${price.toFixed(2)}</td>
          <td>$${total.toFixed(2)}</td>
        </tr>
      `;
    });
    
    // Add total row
    tbody.innerHTML += `
      <tr style="background: rgba(255,255,255,0.05); font-weight: bold;">
        <td colspan="3">Grand Total</td>
        <td>$${grandTotal.toFixed(2)}</td>
      </tr>
    `;
    
    document.getElementById('extractor-json').innerText = JSON.stringify(data, null, 2);
    resultArea.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert("Failed to process request.");
  } finally {
    setLoading(extractBtn, false);
  }
});

// 2. Voice to Order
const voiceInput = document.getElementById('voice-file');
const voiceFileName = document.getElementById('voice-file-name');
const voiceBtn = document.getElementById('btn-voice');

voiceInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    voiceFileName.innerText = e.target.files[0].name;
  } else {
    voiceFileName.innerText = 'No file selected';
  }
});

voiceBtn.addEventListener('click', async () => {
  const file = voiceInput.files[0];
  if (!file) return alert("Please upload an audio file first");
  
  setLoading(voiceBtn, true);
  const resultArea = document.getElementById('voice-result');
  resultArea.classList.add('hidden');
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('/api/voice/voicemails', {
      method: 'POST',
      headers: { 'X-API-Key': 'secret-key' },
      body: formData
    }).catch(err => { console.error(err); return null; });
    
    let data;
    if (response && response.ok) {
      const accepted = await response.json();
      
      // Poll for completion
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const orderResp = await fetch(`/api/voice/jobs/${accepted.job_id}/order`, {
           headers: { 'X-API-Key': 'secret-key' }
        });
        if (orderResp.ok) {
           data = {
             transcript: "Audio transcribed and structured successfully.",
             order_details: await orderResp.json()
           };
           break;
        } else if (orderResp.status === 409) {
           // still processing
           continue;
        } else {
           throw new Error("Job failed or not found");
        }
      }
    } else {
      // Mock Data
      await new Promise(r => setTimeout(r, 1500));
      data = {
        transcript: "Yeah, hi. I'd like to order two large pepperoni pizzas and a two-liter of diet coke.",
        order_details: {
          items: [
            { item: "Large Pepperoni Pizza", quantity: 2 },
            { item: "Diet Coke (2 Liter)", quantity: 1 }
          ],
          confidence: 0.96
        }
      };
    }
    
    document.getElementById('voice-transcript').innerText = `"${data.transcript}"`;
    document.getElementById('voice-json').innerText = JSON.stringify(data.order_details, null, 2);
    resultArea.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert("Failed to process audio.");
  } finally {
    setLoading(voiceBtn, false);
  }
});

// 3. Semantic Matcher
const searchBtn = document.getElementById('btn-search');
const searchInput = document.getElementById('semantic-search');

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchBtn.click();
});

searchBtn.addEventListener('click', async () => {
  const query = searchInput.value;
  if (!query) return;
  
  setLoading(searchBtn, true);
  const resultArea = document.getElementById('search-results');
  resultArea.innerHTML = '';
  resultArea.classList.add('hidden');
  
  try {
    const response = await fetch('/api/products/api/match', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': 'secret-key'
      },
      body: JSON.stringify({ query, topK: 5 })
    }).catch(err => { console.error(err); return null; });
    
    let data;
    if (response && response.ok) {
      data = await response.json();
    } else {
      resultArea.innerHTML = `<div class="error" style="color: #ef4444; padding: 1rem;">Failed to fetch matches. Please try again.</div>`;
      resultArea.classList.remove('hidden');
      setLoading(searchBtn, false);
      return;
    }
    
    let confidentMatches = [];
    if (data.candidates && data.candidates.length > 0) {
      confidentMatches = data.candidates.filter(match => match.score >= 0.65);
    }
    
    if (confidentMatches.length > 0) {
      confidentMatches.forEach((match, index) => {
        const delay = index * 0.1;
        resultArea.innerHTML += `
          <div class="match-card" style="animation-delay: ${delay}s">
            <div class="match-info">
              <h4>${match.name}</h4>
              <p>${match.category} • ${match.unit}</p>
              <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">SKU: ${match.sku}</p>
            </div>
            <div class="match-score">
              ${(match.score * 100).toFixed(1)}% Match
            </div>
          </div>
        `;
      });
    } else {
      resultArea.innerHTML = `<div style="padding: 1rem; color: #64748b;">No matches found with 65%+ confidence.</div>`;
    }
    
    resultArea.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert("Search failed.");
  } finally {
    setLoading(searchBtn, false);
  }
});
