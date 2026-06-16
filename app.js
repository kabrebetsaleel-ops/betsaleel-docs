// 🔥 COLLE TON firebaseConfig ICI - VA DANS FIREBASE CONSOLE > PROJECT SETTINGS > WEB APP
const firebaseConfig = {
  apiKey: "AIzaSyCuFWrXl7A2PfoXiMSezgmnO-Ia_qR5z9o",
  authDomain: "betsaleel-docs.firebaseapp.com",
  projectId: "betsaleel-docs",
  storageBucket: "betsaleel-docs.appspot.com",
  messagingSenderId: "TON_SENDER_ID",
  appId: "TON_APP_ID"
};

// ⚙️ REMPLACE PAR TES ID EMAILJS
const EMAILJS_PUBLIC_KEY = "pEf8t1YOkBu7pG6-6";
const EMAILJS_SERVICE_ID = "service_d72fojp"; 
const EMAILJS_TEMPLATE_ID = "template_7nnau28";

const ADMIN_PASS = "Betsaleel2026@"; // CHANGE MOI APRÈS

// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
emailjs.init(EMAILJS_PUBLIC_KEY);

// État panier
let cart = JSON.parse(localStorage.getItem('betsaleel_cart') || '[]');

// Utils
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = n => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

// Rendu des documents
async function renderDocs() {
  const docsRef = await db.collection('documents').orderBy('createdAt', 'desc').get();
  const docs = docsRef.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const grid = $('#docsGrid');
  if (!docs.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">Aucun document pour l’instant. Reviens bientôt !</p>';
    return;
  }
  
  grid.innerHTML = docs.map(d => `
    <div class="card">
      <img src="${d.imageUrl || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'}" alt="${d.title}">
      <div class="body">
        <span class="badge">${d.niveau} • ${d.matiere}</span>
        <h3>${d.title}</h3>
        <p>${d.description || ''}</p>
        <div class="price-row">
          <div class="price">${money(d.price)}</div>
          <button class="btn" onclick="addToCart('${d.id}')">Ajouter +</button>
        </div>
      </div>
    </div>
  `).join('');
}

// Panier
window.addToCart = async (id) => {
  const doc = await db.collection('documents').doc(id).get();
  const item = { id, ...doc.data() };
  if (!cart.find(c => c.id === id)) {
    cart.push(item);
    localStorage.setItem('betsaleel_cart', JSON.stringify(cart));
    updateCartUI();
    $('#cartBtn').click();
  }
};

function updateCartUI() {
  $('#cartCount').textContent = cart.length;
  const total = cart.reduce((s, i) => s + i.price, 0);
  $('#cartTotal').textContent = money(total);
  $('#cartTotal2').textContent = money(total);
  
  $('#cartItems').innerHTML = cart.length ? cart.map(i => `
    <div class="cart-item">
      <div>
        <strong>${i.title}</strong><br>
        <span style="color:var(--muted);font-size:14px">${i.niveau} • ${i.matiere}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span>${money(i.price)}</span>
        <button class="icon-btn" onclick="removeFromCart('${i.id}')">🗑️</button>
      </div>
    </div>
  `).join('') : '<p style="text-align:center;color:var(--muted);padding:20px">Panier vide</p>';
}

window.removeFromCart = (id) => {
  cart = cart.filter(c => c.id !== id);
  localStorage.setItem('betsaleel_cart', JSON.stringify(cart));
  updateCartUI();
};

// Filtres
$$('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    $$('#docsGrid .card').forEach(card => {
      const badge = card.querySelector('.badge').textContent;
      card.style.display = (f === 'all' || badge.includes(f)) ? 'block' : 'none';
    });
  };
});

// Modals
$('#cartBtn').onclick = () => $('#cartModal').classList.add('show');
$('#closeCart').onclick = () => $('#cartModal').classList.remove('show');
$('#checkoutBtn').onclick = () => {
  if (!cart.length) return alert('Panier vide');
  $('#cartModal').classList.remove('show');
  $('#checkoutModal').classList.add('show');
};
$('#closeCheckout').onclick = () => $('#checkoutModal').classList.remove('show');

// Commande
$('#checkoutForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('#submitOrder');
  btn.disabled = true;
  btn.innerHTML = 'Traitement... <div class="spinner"></div>';
  
  try {
    const orderData = {
      nom: $('#clientName').value,
      email: $('#clientEmail').value,
      transactionId: $('#transactionId').value,
      telephone: $('#clientPhone').value,
      items: cart,
      total: cart.reduce((s, i) => s + i.price, 0),
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('orders').add(orderData);
    
    // Envoi EmailJS
    const listeHtml = cart.map(i => `
      <p><strong>${i.title}</strong><br>
      <a href="https://drive.google.com/uc?export=download&id=${i.driveId}" style="color:#6366f1;font-weight:600;">Télécharger le PDF</a></p>
    `).join('');
    
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: orderData.email,
      nom_client: orderData.nom,
      email_client: orderData.email,
      id_transaction: orderData.transactionId,
      total: money(orderData.total),
      liste_documents: listeHtml
    });
    
    $('#checkoutModal').classList.remove('show');
    $('#successModal').classList.add('show');
    cart = [];
    localStorage.removeItem('betsaleel_cart');
    updateCartUI();
    $('#checkoutForm').reset();
    
  } catch (err) {
    alert('Erreur : ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Confirmer la commande';
  }
};

$('#closeSuccess').onclick = () => $('#successModal').classList.remove('show');

// Admin
if (window.location.pathname.includes('admin')) {
  $('#adminLogin').onsubmit = (e) => {
    e.preventDefault();
    if ($('#adminPass').value === ADMIN_PASS) {
      $('#loginScreen').style.display = 'none';
      $('#adminDashboard').style.display = 'block';
      loadAdminDocs();
      loadAdminOrders();
    } else {
      alert('Mot de passe incorrect');
    }
  };
  
  $('#docForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = 'Publication... <div class="spinner"></div>';
    
    try {
      await db.collection('documents').add({
        title: $('#docTitle').value,
        niveau: $('#docNiveau').value,
        matiere: $('#docMatiere').value,
        price: parseInt($('#docPrice').value),
        driveId: $('#docDriveId').value,
        description: $('#docDesc').value,
        imageUrl: $('#docImage').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      loadAdminDocs();
      alert('Document publié !');
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Publier le document';
    }
  };
}

async function loadAdminDocs() {
  const docs = await db.collection('documents').orderBy('createdAt', 'desc').get();
  $('#docsList').innerHTML = docs.docs.map(d => {
    const doc = d.data();
    return `
      <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${doc.title}</strong> - ${money(doc.price)}<br>
          <span style="color:var(--muted);font-size:13px">${doc.niveau} • ${doc.matiere}</span>
        </div>
        <button class="btn ghost" onclick="deleteDoc('${d.id}')">Supprimer</button>
      </div>
    `;
  }).join('');
}

async function loadAdminOrders() {
  const orders = await db.collection('orders').orderBy('createdAt', 'desc').limit(20).get();
  $('#ordersList').innerHTML = orders.docs.map(o => {
    const ord = o.data();
    const date = ord.createdAt?.toDate().toLocaleString('fr-FR') || '';
    return `
      <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <strong>${ord.nom}</strong>
          <span class="badge">${money(ord.total)}</span>
        </div>
        <div style="font-size:13px;color:var(--muted)">
          ${ord.email} • ${ord.transactionId} • ${date}
        </div>
      </div>
    `;
  }).join('');
}

window.deleteDoc = async (id) => {
  if (confirm('Supprimer ce document ?')) {
    await db.collection('documents').doc(id).delete();
    loadAdminDocs();
  }
};

// Init
renderDocs();
updateCartUI();