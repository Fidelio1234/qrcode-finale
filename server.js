








/*const express = require('express');
const cors = require('cors');
const fs = require('fs');
const escpos = require('escpos');
escpos.Network = require('escpos-network');

const app = express();
app.use(cors());
app.use(express.json());

const FILE_PATH = './ordini.json';
const MENU_FILE_PATH = './menu.json';
const TAVOLI_OCCUPATI_PATH = './tavoliOccupati.json';

// ✅ INIZIALIZZAZIONE SICURA DEI FILE
function inizializzaFile() {
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '[]');
  if (!fs.existsSync(MENU_FILE_PATH)) fs.writeFileSync(MENU_FILE_PATH, '[]');
  if (!fs.existsSync(TAVOLI_OCCUPATI_PATH)) fs.writeFileSync(TAVOLI_OCCUPATI_PATH, '[]');
}
inizializzaFile();

// ✅ COPERT0 ATTIVO DI DEFAULT
let coperto = { attivo: true, prezzo: 2.00 };

// --- Funzioni helper SICURE per file JSON ---
function leggiFileSicuro(path) {
  try {
    const data = fs.readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Errore lettura file ${path}:`, error);
    // Se il file è corrotto, ricrealo
    fs.writeFileSync(path, '[]');
    return [];
  }
}

function scriviFileSicuro(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Errore scrittura file ${path}:`, error);
    return false;
  }
}

// --- Funzioni tavoli MIGLIORATE ---
function occupaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    // ✅ CONTROLLO DUPPLICATI
    if (!occupati.includes(tavolo)) {
      occupati.push(tavolo);
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
      console.log(`✅ Tavolo ${tavolo} occupato - Totale: ${occupati.length}`);
    } else {
      console.log(`ℹ️ Tavolo ${tavolo} già occupato`);
    }
  } catch (error) {
    console.error('❌ Errore occupaTavolo:', error);
  }
}

function liberaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    const prima = occupati.length;
    occupati = occupati.filter(t => t !== tavolo);
    const dopo = occupati.length;
    
    scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
    console.log(`✅ Tavolo ${tavolo} liberato (${prima} -> ${dopo} tavoli occupati)`);
  } catch (error) {
    console.error('❌ Errore liberaTavolo:', error);
  }
}

// --- Coperto ---
app.get('/api/coperto', (req, res) => {
  console.log('📋 Richiesta coperto ricevuta');
  res.json(coperto);
});

app.post('/api/coperto', (req, res) => {
  const { attivo, prezzo } = req.body;
  coperto = { attivo: !!attivo, prezzo: !isNaN(prezzo) ? Number(prezzo) : 0 };
  console.log('⚙️ Coperto aggiornato:', coperto);
  res.json({ success: true, coperto });
});

// --- Ordini MIGLIORATI ---
app.get('/api/ordini', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    console.log('📋 Richiesta ordini - totale:', ordini.length);
    res.json(ordini);
  } catch (error) {
    console.error('❌ Errore /api/ordini:', error);
    res.status(500).json({ error: 'Errore lettura ordini' });
  }
});

// ✅ NUOVO ENDPOINT: Ordini per tavolo specifico
app.get('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    const ordini = leggiFileSicuro(FILE_PATH);
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo);
    
    console.log('📋 Ordini per tavolo', tavolo, ':', ordiniTavolo.length);
    res.json(ordiniTavolo);
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo:', error);
    res.status(500).json({ error: 'Errore lettura ordini tavolo' });
  }
});

app.post('/api/ordina', (req, res) => {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = req.body;
    
    // ✅ VALIDAZIONE DATI
    if (!ordine.tavolo || !ordine.ordinazione) {
      return res.status(400).json({ error: 'Dati ordine incompleti' });
    }
    
    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
    
    console.log('📦 Nuovo ordine:', {
      tavolo: ordine.tavolo,
      items: ordine.ordinazione.length,
      coperto: ordine.coperto || 0
    });
    
    ordini.push(ordine);
    
    // ✅ SALVA SUBITO L'ORDINE
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore salvataggio ordine' });
    }
    
    // ✅ OCCUPA TAVOLO
    occupaTavolo(ordine.tavolo);

    // ✅ TENTA STAMPA (NON BLOCCANTE)
    stampaOrdine(ordine)
      .then(() => {
        console.log('✅ Ordine stampato per tavolo:', ordine.tavolo);
      })
      .catch(err => {
        console.error('❌ Errore stampa:', err);
      });
    
    // ✅ RISPOSTA IMMEDIATA
    res.json({ 
      message: 'Ordine ricevuto con successo', 
      printed: true,
      id: ordine.id 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordina:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/ordini/:id/evaso', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const index = ordini.findIndex(o => o.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    
    ordini[index].stato = 'evaso';
    ordini[index].evasoIl = new Date().toISOString();
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordine' });
    }
    
    console.log('✅ Ordine evaso:', id);
    res.json({ message: 'Ordine evaso' });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/:id/evaso:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.delete('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo);
    
    ordini = ordini.filter(o => o.tavolo.toString() !== tavolo);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore eliminazione ordini' });
    }
    
    liberaTavolo(tavolo);
    
    console.log('✅ Tavolo chiuso:', tavolo, '- Ordini eliminati:', ordiniTavolo.length);
    res.json({ 
      message: 'Tavolo chiuso e liberato', 
      ordiniEliminati: ordiniTavolo.length 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Tavoli occupati ---
app.get('/api/tavoli/occupati', (req, res) => {
  try {
    const occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    console.log('📋 Tavoli occupati richiesti:', occupati);
    res.json(occupati);
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupati:', error);
    res.status(500).json({ error: 'Errore lettura tavoli occupati' });
  }
});

app.post('/api/tavoli/occupa', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Numero tavolo mancante' });
    }
    
    occupaTavolo(tavolo);
    console.log('📍 Tavolo occupato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} occupato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupa:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/tavoli/libera', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Numero tavolo mancante' });
    }
    
    liberaTavolo(tavolo);
    console.log('✅ Tavolo liberato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} liberato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/libera:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Menu ---
app.get('/api/menu', (req, res) => {
  try {
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    console.log('📋 Richiesta menu - prodotti:', menu.length);
    res.json(menu);
  } catch (error) {
    console.error('❌ Errore /api/menu:', error);
    res.status(500).json({ error: 'Errore lettura menu' });
  }
});

app.post('/api/menu', (req, res) => {
  try {
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const nuovoProdotto = req.body;
    nuovoProdotto.id = Date.now();
    menu.push(nuovoProdotto);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore salvataggio menu' });
    }
    
    console.log('✅ Prodotto aggiunto:', nuovoProdotto.nome);
    res.json({ message: 'Prodotto aggiunto', id: nuovoProdotto.id });
    
  } catch (error) {
    console.error('❌ Errore /api/menu POST:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Modifica prodotto ---
app.put('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const index = menu.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Prodotto non trovato' });

    menu[index] = { ...menu[index], ...req.body };
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore aggiornamento menu' });
    }
    
    console.log('✅ Prodotto modificato:', menu[index].nome);
    res.json({ message: 'Prodotto modificato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id PUT:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina prodotto ---
app.delete('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodotto = menu.find(p => p.id === id);
    menu = menu.filter(p => p.id !== id);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione prodotto' });
    }
    
    console.log('✅ Prodotto eliminato:', prodotto?.nome);
    res.json({ message: 'Prodotto eliminato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id DELETE:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina categoria ---
app.delete('/api/categoria/:categoria', (req, res) => {
  try {
    const cat = req.params.categoria;
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodottiEliminati = menu.filter(p => p.categoria === cat);
    menu = menu.filter(p => p.categoria !== cat);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione categoria' });
    }
    
    console.log('✅ Categoria eliminata:', cat, '- Prodotti:', prodottiEliminati.length);
    res.json({ 
      message: `Categoria "${cat}" eliminata`, 
      prodottiEliminati: prodottiEliminati.length 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/categoria/:categoria:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Funzione stampa ---
function stampaOrdine(ordine) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordine.ipStampante || '192.168.1.100';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Errore connessione stampante:', err);
        return reject(err);
      }
      
      console.log('🖨️ Stampa ordine per tavolo:', ordine.tavolo);
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('RISTORANTE BELLAVISTA')
        .text('----------------------')
        .align('lt')
        .style('normal')
        .size(0, 0)
        .text(`TAVOLO: ${ordine.tavolo}`)
        .text(`DATA: ${new Date().toLocaleString()}`)
        .text('----------------------')
        .text('ORDINE:')
        .text('');
      
      ordine.ordinazione.forEach((item, index) => {
        if (item.prodotto.includes('Coperto')) {
          printer
            .text(`${item.prodotto}`)
            .text(`   € ${item.prezzo.toFixed(2)}`);
        } else {
          printer
            .text(`${item.quantità} x ${item.prodotto}`)
            .text(`   € ${(item.prezzo * item.quantità).toFixed(2)}`);
        }
      });
      
      const totale = ordine.ordinazione.reduce((sum, item) => sum + (item.prezzo * item.quantità), 0);
      
      printer
        .text('----------------------')
        .style('b')
        .text(`TOTALE: € ${totale.toFixed(2)}`)
        .style('normal')
        .text('')
        .text('Grazie e buon appetito!')
        .cut()
        .close();
      
      console.log('✅ Stampa completata per tavolo:', ordine.tavolo);
      resolve();
    });
  });
}

// --- Health check MIGLIORATO ---
app.get('/api/health', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    const tavoliOccupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    res.json({ 
      status: 'OK', 
      server: 'Ristorante Bellavista',
      version: '2.0',
      timestamp: new Date().toISOString(),
      statistiche: {
        ordini: ordini.length,
        menu: menu.length,
        tavoliOccupati: tavoliOccupati.length
      },
      coperto: coperto
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      error: error.message 
    });
  }
});

// --- Gestione errori globale ---
app.use((err, req, res, next) => {
  console.error('❌ Errore server:', err);
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message 
  });
});

// ✅ 404 handler CORRETTO
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint non trovato',
    path: req.path,
    method: req.method
  });
});

// --- Avvio server ---
const PORT = 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🍕 SERVER RISTORANTE BELLAVISTA - VERSIONE MIGLIORATA');
  console.log('📍 Server avviato su:', `http://${HOST}:${PORT}`);
  console.log('✅ Coperto attivo:', coperto.attivo, '- Prezzo: €', coperto.prezzo);
  console.log('📋 Endpoints principali:');
  console.log('   GET  /api/health          - Stato server');
  console.log('   GET  /api/ordini          - Tutti gli ordini');
  console.log('   GET  /api/ordini/tavolo/:tavolo - Ordini per tavolo');
  console.log('   POST /api/ordina          - Nuovo ordine');
  console.log('   GET  /api/tavoli/occupati - Tavoli occupati');
  console.log('-----------------------------------');
});

*/













/*const express = require('express');
const cors = require('cors');
const fs = require('fs');
const escpos = require('escpos');
escpos.Network = require('escpos-network');

const app = express();
app.use(cors());
app.use(express.json());

const FILE_PATH = './ordini.json';
const MENU_FILE_PATH = './menu.json';
const TAVOLI_OCCUPATI_PATH = './tavoliOccupati.json';

// ✅ SAFE FILE INITIALIZATION
function inizializzaFile() {
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '[]');
  if (!fs.existsSync(MENU_FILE_PATH)) fs.writeFileSync(MENU_FILE_PATH, '[]');
  if (!fs.existsSync(TAVOLI_OCCUPATI_PATH)) fs.writeFileSync(TAVOLI_OCCUPATI_PATH, '[]');
}
inizializzaFile();

// ✅ COVER CHARGE ACTIVE BY DEFAULT
let coperto = { attivo: true, prezzo: 2.00 };

// --- Safe JSON file helper functions ---
function leggiFileSicuro(path) {
  try {
    const data = fs.readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading file ${path}:`, error);
    fs.writeFileSync(path, '[]');
    return [];
  }
}

function scriviFileSicuro(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Error writing file ${path}:`, error);
    return false;
  }
}

// --- Improved table functions ---
function occupaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    if (!occupati.includes(tavolo)) {
      occupati.push(tavolo);
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
      console.log(`✅ Table ${tavolo} occupied - Total: ${occupati.length}`);
    } else {
      console.log(`ℹ️ Table ${tavolo} already occupied`);
    }
  } catch (error) {
    console.error('❌ Error occupaTavolo:', error);
  }
}

function liberaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    console.log('🔍 BEFORE liberation:', occupati);
    
    const prima = occupati.length;
    occupati = occupati.filter(t => t.toString() !== tavolo.toString());
    const dopo = occupati.length;
    
    console.log('🔍 AFTER liberation:', occupati);
    
    scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
    console.log(`✅ Table ${tavolo} freed (${prima} -> ${dopo} occupied tables)`);
    
    return dopo < prima;
  } catch (error) {
    console.error('❌ Error liberaTavolo:', error);
    return false;
  }
}

// --- Clean old orders (after 5:00 AM) ---
function pulisciOrdiniVecchi() {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const oraCorrente = new Date();
    const oggi5AM = new Date();
    oggi5AM.setHours(5, 0, 0, 0);
    
    if (oraCorrente < oggi5AM) {
      oggi5AM.setDate(oggi5AM.getDate() - 1);
    }
    
    const ordiniFiltrati = ordini.filter(ordine => {
      const dataOrdine = new Date(ordine.timestamp);
      return dataOrdine >= oggi5AM;
    });
    
    if (ordiniFiltrati.length !== ordini.length) {
      console.log(`🧹 Cleaned ${ordini.length - ordiniFiltrati.length} old orders (before 5:00 AM)`);
      scriviFileSicuro(FILE_PATH, ordiniFiltrati);
    }
    
    return ordiniFiltrati;
  } catch (error) {
    console.error('❌ Error cleaning orders:', error);
    return leggiFileSicuro(FILE_PATH);
  }
}

// --- Cover Charge Endpoints ---
app.get('/api/coperto', (req, res) => {
  console.log('📋 Cover charge request received');
  res.json(coperto);
});

app.post('/api/coperto', (req, res) => {
  const { attivo, prezzo } = req.body;
  coperto = { attivo: !!attivo, prezzo: !isNaN(prezzo) ? Number(prezzo) : 0 };
  console.log('⚙️ Cover charge updated:', coperto);
  res.json({ success: true, coperto });
});

// --- Order Endpoints ---

// ✅ ACTIVE ORDERS (excludes closed ones)
app.get('/api/ordini', (req, res) => {
  try {
    const ordiniPuliti = pulisciOrdiniVecchi();
    const ordiniAttivi = ordiniPuliti.filter(ordine => ordine.stato !== 'chiuso');
    console.log('📋 Active orders request - total:', ordiniAttivi.length);
    res.json(ordiniAttivi);
  } catch (error) {
    console.error('❌ Error /api/ordini:', error);
    res.status(500).json({ error: 'Error reading orders' });
  }
});






// ✅ COMPLETE ORDERS (including closed)
// ✅ COMPLETE ORDERS (including closed) WITH TOTAL
app.get('/api/ordini/completo', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    
    // ✅ AGGIUNGI IL TOTALE PER OGNI ORDINE
    const ordiniConTotale = ordini.map(ordine => {
      const totaleOrdine = ordine.ordinazione.reduce((sum, item) => 
        sum + (item.prezzo * item.quantità), 0
      );
      
      return {
        ...ordine,
        totale: totaleOrdine // ✅ AGGIUNGI IL TOTALE
      };
    });
    
    console.log('📋 Complete orders request - total:', ordiniConTotale.length);
    res.json(ordiniConTotale);
  } catch (error) {
    console.error('❌ Error /api/ordini/completo:', error);
    res.status(500).json({ error: 'Error reading complete orders' });
  }
});

// ✅ ENDPOINT PER OTTENERE IL TOTALE DI UN TAVOLO CHIUSO
app.get('/api/tavoli/:tavolo/totale', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    const ordini = leggiFileSicuro(FILE_PATH);
    
    // ✅ FILTRA SOLO GLI ORDINI CHIUSI DEL TAVOLO
    const ordiniTavoloChiusi = ordini.filter(o => 
      o.tavolo.toString() === tavolo && o.stato === 'chiuso'
    );
    
    // ✅ CALCOLA IL TOTALE COMPLESSIVO DEL TAVOLO
    const totaleTavolo = ordiniTavoloChiusi.reduce((totale, ordine) => {
      const totaleOrdine = ordine.ordinazione.reduce((sum, item) => 
        sum + (item.prezzo * item.quantità), 0
      );
      return totale + totaleOrdine;
    }, 0);
    
    console.log(`💰 Total for closed table ${tavolo}: € ${totaleTavolo.toFixed(2)}`);
    
    res.json({
      tavolo: tavolo,
      totale: totaleTavolo,
      ordiniChiusi: ordiniTavoloChiusi.length,
      dettaglioOrdini: ordiniTavoloChiusi.map(o => ({
        id: o.id,
        totaleOrdine: o.ordinazione.reduce((sum, item) => sum + (item.prezzo * item.quantità), 0),
        data: o.dataOra || o.timestamp
      }))
    });
    
  } catch (error) {
    console.error('❌ Error /api/tavoli/:tavolo/totale:', error);
    res.status(500).json({ error: 'Error calculating table total' });
  }
});














app.post('/api/ordina', (req, res) => {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = req.body;
    
    if (!ordine.tavolo || !ordine.ordinazione) {
      return res.status(400).json({ error: 'Incomplete order data' });
    }
    
    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
    ordine.dataOra = new Date().toLocaleString('it-IT');
    
    console.log('📦 New order:', {
      table: ordine.tavolo,
      items: ordine.ordinazione.length,
      date: ordine.dataOra
    });
    
    ordini.push(ordine);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Error saving order' });
    }
    
    occupaTavolo(ordine.tavolo);

    stampaOrdine(ordine)
      .then(() => {
        console.log('✅ Order printed for table:', ordine.tavolo);
      })
      .catch(err => {
        console.error('❌ Print error:', err);
      });
    
    res.json({ 
      message: 'Order received successfully', 
      printed: true,
      id: ordine.id 
    });
    
  } catch (error) {
    console.error('❌ Error /api/ordina:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/ordini/:id/evaso', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const index = ordini.findIndex(o => o.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    ordini[index].stato = 'evaso';
    ordini[index].evasoIl = new Date().toISOString();
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Error updating order' });
    }
    
    console.log('✅ Order completed:', id);
    res.json({ message: 'Order completed' });
    
  } catch (error) {
    console.error('❌ Error /api/ordini/:id/evaso:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ DELETE ENDPOINT TO CLOSE TABLE - MARK AS CLOSED
app.delete('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    console.log(`🔄 Closing table ${tavolo}...`);
    
    let ordini = leggiFileSicuro(FILE_PATH);
    console.log(`📊 Total orders before closing: ${ordini.length}`);
    
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo);
    console.log(`📋 Orders for table ${tavolo}: ${ordiniTavolo.length}`);
    
    if (ordiniTavolo.length === 0) {
      console.log(`ℹ️ No orders found for table ${tavolo}`);
      liberaTavolo(tavolo);
      return res.json({ 
        message: 'Table closed (no orders found)', 
        ordiniChiusi: 0 
      });
    }
    
    // ✅ MARK ORDERS AS "CLOSED" - DON'T DELETE THEM
    let updatedCount = 0;
    ordini = ordini.map(ordine => {
      if (ordine.tavolo.toString() === tavolo && ordine.stato !== 'chiuso') {
        updatedCount++;
        return {
          ...ordine,
          stato: 'chiuso',
          chiusoIl: new Date().toLocaleString('it-IT')
        };
      }
      return ordine;
    });
    
    console.log(`✅ Marked ${updatedCount} orders as closed`);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Error updating orders' });
    }
    
    // ✅ FREE THE TABLE
    liberaTavolo(tavolo);
    
    console.log(`✅ Table ${tavolo} closed successfully - Orders closed: ${updatedCount}`);
    res.json({ 
      message: 'Table closed successfully', 
      ordiniChiusi: updatedCount 
    });
    
  } catch (error) {
    console.error('❌ Error /api/ordini/tavolo/:tavolo:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// --- Occupied tables ---
app.get('/api/tavoli/occupati', (req, res) => {
  try {
    const occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    console.log('📋 Occupied tables requested:', occupati);
    res.json(occupati);
  } catch (error) {
    console.error('❌ Error /api/tavoli/occupati:', error);
    res.status(500).json({ error: 'Error reading occupied tables' });
  }
});

app.post('/api/tavoli/occupa', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    occupaTavolo(tavolo);
    console.log('📍 Table occupied via API:', tavolo);
    res.json({ message: `Table ${tavolo} occupied` });
    
  } catch (error) {
    console.error('❌ Error /api/tavoli/occupa:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tavoli/libera', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    liberaTavolo(tavolo);
    console.log('✅ Table freed via API:', tavolo);
    res.json({ message: `Table ${tavolo} freed` });
    
  } catch (error) {
    console.error('❌ Error /api/tavoli/libera:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Menu ---
app.get('/api/menu', (req, res) => {
  try {
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    console.log('📋 Menu request - products:', menu.length);
    res.json(menu);
  } catch (error) {
    console.error('❌ Error /api/menu:', error);
    res.status(500).json({ error: 'Error reading menu' });
  }
});

app.post('/api/menu', (req, res) => {
  try {
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const nuovoProdotto = req.body;
    nuovoProdotto.id = Date.now();
    menu.push(nuovoProdotto);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Error saving menu' });
    }
    
    console.log('✅ Product added:', nuovoProdotto.nome);
    res.json({ message: 'Product added', id: nuovoProdotto.id });
    
  } catch (error) {
    console.error('❌ Error /api/menu POST:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Modify product ---
app.put('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const index = menu.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Product not found' });

    menu[index] = { ...menu[index], ...req.body };
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Error updating menu' });
    }
    
    console.log('✅ Product modified:', menu[index].nome);
    res.json({ message: 'Product modified' });
    
  } catch (error) {
    console.error('❌ Error /api/menu/:id PUT:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Delete product ---
app.delete('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodotto = menu.find(p => p.id === id);
    menu = menu.filter(p => p.id !== id);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Error deleting product' });
    }
    
    console.log('✅ Product deleted:', prodotto?.nome);
    res.json({ message: 'Product deleted' });
    
  } catch (error) {
    console.error('❌ Error /api/menu/:id DELETE:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Delete category ---
app.delete('/api/categoria/:categoria', (req, res) => {
  try {
    const cat = req.params.categoria;
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodottiEliminati = menu.filter(p => p.categoria === cat);
    menu = menu.filter(p => p.categoria !== cat);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Error deleting category' });
    }
    
    console.log('✅ Category deleted:', cat, '- Products:', prodottiEliminati.length);
    res.json({ 
      message: `Category "${cat}" deleted`, 
      prodottiEliminati: prodottiEliminati.length 
    });
    
  } catch (error) {
    console.error('❌ Error /api/categoria/:categoria:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Print function ---
function stampaOrdine(ordine) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordine.ipStampante || '192.168.1.100';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Printer connection error:', err);
        return reject(err);
      }
      
      console.log('🖨️ Printing order for table:', ordine.tavolo);
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('RISTORANTE BELLAVISTA')
        .text('----------------------')
        .align('lt')
        .style('normal')
        .size(0, 0)
        .text(`TABLE: ${ordine.tavolo}`)
        .text(`DATE: ${new Date().toLocaleString()}`)
        .text('----------------------')
        .text('ORDER:')
        .text('');
      
      ordine.ordinazione.forEach((item, index) => {
        if (item.prodotto.includes('Coperto')) {
          printer
            .text(`${item.prodotto}`)
            .text(`   € ${item.prezzo.toFixed(2)}`);
        } else {
          printer
            .text(`${item.quantità} x ${item.prodotto}`)
            .text(`   € ${(item.prezzo * item.quantità).toFixed(2)}`);
        }
      });
      
      const totale = ordine.ordinazione.reduce((sum, item) => sum + (item.prezzo * item.quantità), 0);
      
      printer
        .text('----------------------')
        .style('b')
        .text(`TOTAL: € ${totale.toFixed(2)}`)
        .style('normal')
        .text('')
        .text('Thank you and enjoy your meal!')
        .cut()
        .close();
      
      console.log('✅ Print completed for table:', ordine.tavolo);
      resolve();
    });
  });
}

// ✅ DEBUG ENDPOINT - CHECK TABLE STATUS
app.get('/api/debug/tavoli', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    const occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    const tavoliConOrdiniAttivi = [...new Set(ordini.filter(o => o.stato !== 'chiuso').map(o => o.tavolo))];
    const tavoliConOrdiniChiusi = [...new Set(ordini.filter(o => o.stato === 'chiuso').map(o => o.tavolo))];
    
    res.json({
      tavoliOccupati: occupati,
      tavoliConOrdiniAttivi: tavoliConOrdiniAttivi,
      tavoliConOrdiniChiusi: tavoliConOrdiniChiusi,
      statistiche: {
        ordiniTotali: ordini.length,
        ordiniAttivi: ordini.filter(o => o.stato !== 'chiuso').length,
        ordiniChiusi: ordini.filter(o => o.stato === 'chiuso').length
      },
      tuttiOrdini: ordini.map(o => ({ 
        id: o.id, 
        tavolo: o.tavolo, 
        stato: o.stato, 
        chiusoIl: o.chiusoIl 
      }))
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Improved Health check ---
app.get('/api/health', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    const tavoliOccupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    const ordiniAttivi = ordini.filter(o => o.stato !== 'chiuso');
    
    res.json({ 
      status: 'OK', 
      server: 'Ristorante Bellavista',
      version: '2.0',
      timestamp: new Date().toISOString(),
      statistics: {
        totalOrders: ordini.length,
        activeOrders: ordiniAttivi.length,
        closedOrders: ordini.length - ordiniAttivi.length,
        menu: menu.length,
        occupiedTables: tavoliOccupati.length
      },
      coverCharge: coperto
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      error: error.message 
    });
  }
});

// --- Global error handling ---
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ✅ 404 handler CORRECT
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// --- Start server ---
const PORT = 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🍕 BELLAVISTA RESTAURANT SERVER - CORRECT VERSION');
  console.log('📍 Server started on:', `http://${HOST}:${PORT}`);
  console.log('✅ Cover charge active:', coperto.attivo, '- Price: €', coperto.prezzo);
  console.log('📋 Main endpoints:');
  console.log('   GET  /api/health          - Server status');
  console.log('   GET  /api/ordini          - ACTIVE orders (excludes closed)');
  console.log('   GET  /api/ordini/completo - All orders');
  console.log('   GET  /api/ordini/tavolo/:tavolo - Active orders by table');
  console.log('   DELETE /api/ordini/tavolo/:tavolo - Close table');
  console.log('   GET  /api/debug/tavoli    - Table debug');
  console.log('-----------------------------------');
});



*/

























// backend/server.js
/*const express = require('express');
const cors = require('cors');
const fs = require('fs');
const escpos = require('escpos');
escpos.Network = require('escpos-network');

// ✅ IMPORTIAMO IL SISTEMA LICENZE
const { licenseCheck, licenseInfo } = require('./license-middleware');
const licenseRoutes = require('./license-routes');
const LicenseManager = require('./license-manager');

const app = express();
app.use(cors());
app.use(express.json());

const FILE_PATH = './ordini.json';
const MENU_FILE_PATH = './menu.json';
const TAVOLI_OCCUPATI_PATH = './tavoliOccupati.json';

// ✅ INIZIALIZZAZIONE SICURA DEI FILE
function inizializzaFile() {
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '[]');
  if (!fs.existsSync(MENU_FILE_PATH)) fs.writeFileSync(MENU_FILE_PATH, '[]');
  if (!fs.existsSync(TAVOLI_OCCUPATI_PATH)) fs.writeFileSync(TAVOLI_OCCUPATI_PATH, '[]');
}
inizializzaFile();

// ✅ INIZIALIZZA IL LICENSE MANAGER
const licenseManager = new LicenseManager();
console.log('🔐 Sistema licenze inizializzato');

// ✅ COPERT0 ATTIVO DI DEFAULT
let coperto = { attivo: true, prezzo: 2.00 };

// --- Funzioni helper SICURE per file JSON ---
function leggiFileSicuro(path) {
  try {
    const data = fs.readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Errore lettura file ${path}:`, error);
    fs.writeFileSync(path, '[]');
    return [];
  }
}

function scriviFileSicuro(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Errore scrittura file ${path}:`, error);
    return false;
  }
}

// --- Funzioni tavoli MIGLIORATE ---
function occupaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    if (!occupati.includes(tavolo)) {
      occupati.push(tavolo);
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
      console.log(`✅ Tavolo ${tavolo} occupato - Totale: ${occupati.length}`);
    } else {
      console.log(`ℹ️ Tavolo ${tavolo} già occupato`);
    }
  } catch (error) {
    console.error('❌ Errore occupaTavolo:', error);
  }
}

function liberaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    const prima = occupati.length;
    occupati = occupati.filter(t => t.toString() !== tavolo.toString());
    const dopo = occupati.length;
    
    scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
    console.log(`✅ Tavolo ${tavolo} liberato (${prima} -> ${dopo} tavoli occupati)`);
    
    return dopo < prima;
  } catch (error) {
    console.error('❌ Errore liberaTavolo:', error);
    return false;
  }
}






// --- Funzione per pulire ordini vecchi (dopo le 5:00) ---
// ✅ FUNZIONE MIGLIORATA CON DEBUG
// ✅ FUNZIONE CORRETTA PER PULIRE ORDINI VECCHI
function pulisciOrdiniVecchi() {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    console.log(`📊 Ordini prima della pulizia: ${ordini.length}`);
    
    // ✅ FORZA LA PULIZIA DI TUTTI GLI ORDINI (temporaneo)
    if (ordini.length > 0) {
      console.log(`🧹 FORZATA PULIZIA: Eliminando tutti i ${ordini.length} ordini`);
      scriviFileSicuro(FILE_PATH, []);
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, []);
      console.log('✅ Pulizia forzata completata');
      return [];
    }
    
    return ordini;
    
  } catch (error) {
    console.error('❌ Errore pulizia ordini:', error);
    return leggiFileSicuro(FILE_PATH);
  }
}






// ✅ APPLICHIAMO IL CONTROLLO LICENZE A TUTTE LE ROUTES API
// (eccetto quelle pubbliche definite nel middleware)

app.use('/api/license', licenseRoutes);

// ✅ HEALTH CHECK PUBBLICO (funziona sempre)
app.get('/api/health', (req, res) => {
  const licenseStatus = licenseManager.verifyLicense();
  
  res.json({ 
    status: 'OK', 
    server: 'Ristorante Bellavista',
    version: '2.0',
    timestamp: new Date().toISOString(),
    license: {
      valid: licenseStatus.valid,
      type: licenseStatus.license?.type,
      daysRemaining: licenseStatus.daysRemaining,
      expiry: licenseStatus.license?.expiryDate
    }
  });
});

// ✅ APPLICA CONTROLLO LICENZE A TUTTE LE ALTRE API
app.use('/api', licenseCheck);

// --- Endpoint Coperto ---
app.get('/api/coperto', (req, res) => {
  console.log('📋 Richiesta coperto ricevuta');
  res.json(coperto);
});

app.post('/api/coperto', (req, res) => {
  const { attivo, prezzo } = req.body;
  coperto = { attivo: !!attivo, prezzo: !isNaN(prezzo) ? Number(prezzo) : 0 };
  console.log('⚙️ Coperto aggiornato:', coperto);
  res.json({ success: true, coperto });
});

// --- Endpoint Ordini ---

// ✅ ORDINI ATTIVI (esclude i chiusi)
app.get('/api/ordini', (req, res) => {
  try {
    const ordiniPuliti = pulisciOrdiniVecchi();
    const ordiniAttivi = ordiniPuliti.filter(ordine => ordine.stato !== 'chiuso');
    console.log('📋 Richiesta ordini ATTIVI - totali:', ordiniAttivi.length);
    res.json(ordiniAttivi);
  } catch (error) {
    console.error('❌ Errore /api/ordini:', error);
    res.status(500).json({ error: 'Errore lettura ordini' });
  }
});

// ✅ ORDINI COMPLETI (anche chiusi)
app.get('/api/ordini/completo', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    console.log('📋 Richiesta ordini COMPLETI - totali:', ordini.length);
    res.json(ordini);
  } catch (error) {
    console.error('❌ Errore /api/ordini/completo:', error);
    res.status(500).json({ error: 'Errore lettura ordini completi' });
  }
});

// ✅ ORDINI PER TAVOLO (solo attivi)
app.get('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    const ordini = leggiFileSicuro(FILE_PATH);
    const ordiniTavolo = ordini.filter(o => 
      o.tavolo.toString() === tavolo && o.stato !== 'chiuso'
    );
    console.log(`📋 Ordini attivi tavolo ${tavolo}:`, ordiniTavolo.length);
    res.json(ordiniTavolo);
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore lettura ordini tavolo' });
  }
});

app.post('/api/ordina', (req, res) => {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = req.body;
    
    if (!ordine.tavolo || !ordine.ordinazione) {
      return res.status(400).json({ error: 'Dati ordine incompleti' });
    }
    
    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
    ordine.dataOra = new Date().toLocaleString('it-IT');
    
    console.log('📦 Nuovo ordine:', {
      tavolo: ordine.tavolo,
      items: ordine.ordinazione.length,
      data: ordine.dataOra
    });
    
    ordini.push(ordine);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore salvataggio ordine' });
    }
    
    occupaTavolo(ordine.tavolo);

    stampaOrdine(ordine)
      .then(() => {
        console.log('✅ Ordine stampato per tavolo:', ordine.tavolo);
      })
      .catch(err => {
        console.error('❌ Errore stampa:', err);
      });
    
    res.json({ 
      message: 'Ordine ricevuto con successo', 
      printed: true,
      id: ordine.id 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordina:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/ordini/:id/evaso', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const index = ordini.findIndex(o => o.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    
    ordini[index].stato = 'evaso';
    ordini[index].evasoIl = new Date().toISOString();
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordine' });
    }
    
    console.log('✅ Ordine evaso:', id);
    res.json({ message: 'Ordine evaso' });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/:id/evaso:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT DELETE PER CHIUDERE TAVOLO - MARCHIA COME CHIUSO
app.delete('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    console.log(`🔄 Closing table ${tavolo}...`);
    
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo);
    
    // ✅ SEGNA GLI ORDINI COME "CHIUSO" - NON ELIMINARLI
    let updatedCount = 0;
    ordini = ordini.map(ordine => {
      if (ordine.tavolo.toString() === tavolo && ordine.stato !== 'chiuso') {
        updatedCount++;
        return {
          ...ordine,
          stato: 'chiuso',
          chiusoIl: new Date().toLocaleString('it-IT')
        };
      }
      return ordine;
    });
    
    console.log(`✅ Marked ${updatedCount} orders as closed`);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordini' });
    }
    
    // ✅ LIBERA IL TAVOLO
    liberaTavolo(tavolo);
    
    console.log(`✅ Table ${tavolo} closed successfully - Orders closed: ${updatedCount}`);
    res.json({ 
      message: 'Table closed successfully', 
      ordiniChiusi: updatedCount 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Tavoli occupati ---
app.get('/api/tavoli/occupati', (req, res) => {
  try {
    const occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    console.log('📋 Tavoli occupati richiesti:', occupati);
    res.json(occupati);
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupati:', error);
    res.status(500).json({ error: 'Errore lettura tavoli occupati' });
  }
});

app.post('/api/tavoli/occupa', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    occupaTavolo(tavolo);
    console.log('📍 Tavolo occupato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} occupato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupa:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/tavoli/libera', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    liberaTavolo(tavolo);
    console.log('✅ Tavolo liberato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} liberato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/libera:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Menu ---
app.get('/api/menu', (req, res) => {
  try {
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    console.log('📋 Richiesta menu - prodotti:', menu.length);
    res.json(menu);
  } catch (error) {
    console.error('❌ Errore /api/menu:', error);
    res.status(500).json({ error: 'Errore lettura menu' });
  }
});

app.post('/api/menu', (req, res) => {
  try {
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const nuovoProdotto = req.body;
    nuovoProdotto.id = Date.now();
    menu.push(nuovoProdotto);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore salvataggio menu' });
    }
    
    console.log('✅ Prodotto aggiunto:', nuovoProdotto.nome);
    res.json({ message: 'Prodotto aggiunto', id: nuovoProdotto.id });
    
  } catch (error) {
    console.error('❌ Errore /api/menu POST:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Modifica prodotto ---
app.put('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const index = menu.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Prodotto non trovato' });

    menu[index] = { ...menu[index], ...req.body };
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore aggiornamento menu' });
    }
    
    console.log('✅ Prodotto modificato:', menu[index].nome);
    res.json({ message: 'Prodotto modificato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id PUT:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina prodotto ---
app.delete('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodotto = menu.find(p => p.id === id);
    menu = menu.filter(p => p.id !== id);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione prodotto' });
    }
    
    console.log('✅ Prodotto eliminato:', prodotto?.nome);
    res.json({ message: 'Prodotto eliminato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id DELETE:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina categoria ---
app.delete('/api/categoria/:categoria', (req, res) => {
  try {
    const cat = req.params.categoria;
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodottiEliminati = menu.filter(p => p.categoria === cat);
    menu = menu.filter(p => p.categoria !== cat);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione categoria' });
    }
    
    console.log('✅ Categoria eliminata:', cat, '- Prodotti:', prodottiEliminati.length);
    res.json({ 
      message: `Categoria "${cat}" eliminata`, 
      prodottiEliminati: prodottiEliminati.length 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/categoria/:categoria:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Funzione stampa ---
function stampaOrdine(ordine) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordine.ipStampante || '192.168.1.100';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Errore connessione stampante:', err);
        return reject(err);
      }
      
      console.log('🖨️ Stampa ordine per tavolo:', ordine.tavolo);
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('RISTORANTE BELLAVISTA')
        .text('----------------------')
        .align('lt')
        .style('normal')
        .size(0, 0)
        .text(`TAVOLO: ${ordine.tavolo}`)
        .text(`DATA: ${new Date().toLocaleString()}`)
        .text('----------------------')
        .text('ORDINE:')
        .text('');
      
      ordine.ordinazione.forEach((item, index) => {
        if (item.prodotto.includes('Coperto')) {
          printer
            .text(`${item.prodotto}`)
            .text(`   € ${item.prezzo.toFixed(2)}`);
        } else {
          printer
            .text(`${item.quantità} x ${item.prodotto}`)
            .text(`   € ${(item.prezzo * item.quantità).toFixed(2)}`);
        }
      });
      
      const totale = ordine.ordinazione.reduce((sum, item) => sum + (item.prezzo * item.quantità), 0);
      
      printer
        .text('----------------------')
        .style('b')
        .text(`TOTALE: € ${totale.toFixed(2)}`)
        .style('normal')
        .text('')
        .text('Grazie e buon appetito!')
        .cut()
        .close();
      
      console.log('✅ Stampa completata per tavolo:', ordine.tavolo);
      resolve();
    });
  });
}

// --- Gestione errori globale ---
app.use((err, req, res, next) => {
  console.error('❌ Errore server:', err);
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message 
  });
});

// ✅ 404 handler CORRETTO
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint non trovato',
    path: req.path,
    method: req.method
  });
});

// --- Avvio server ---
const PORT = 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🍕 SERVER RISTORANTE BELLAVISTA - SISTEMA LICENZE ATTIVO');
  console.log('📍 Server avviato su:', `http://${HOST}:${PORT}`);
  console.log('🔐 Sistema licenze: ATTIVO');
  console.log('📋 Endpoints licenza:');
  console.log('   GET  /api/license/status    - Stato licenza');
  console.log('   POST /api/license/trial     - Attiva trial');
  console.log('   POST /api/license/activate  - Attiva licenza');
  console.log('-----------------------------------');
  
  // Verifica licenza all'avvio
  const licenseStatus = licenseManager.verifyLicense();
  console.log('📄 Stato licenza iniziale:', licenseStatus.valid ? 'VALIDO' : 'NON VALIDO');
  if (licenseStatus.valid) {
    console.log(`   Tipo: ${licenseStatus.type} - Giorni rimanenti: ${licenseStatus.daysRemaining}`);
  } else {
    console.log(`   Motivo: ${licenseStatus.reason}`);
  }
});


*/





















/*const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { licenseCheck, licenseInfo } = require('./license-middleware');
const licenseRoutes = require('./license-routes');
const LicenseManager = require('./license-manager');

const app = express();
app.use(cors());
app.use(express.json());

const FILE_PATH = './ordini.json';
const MENU_FILE_PATH = './menu.json';
const TAVOLI_OCCUPATI_PATH = './tavoliOccupati.json';

// ✅ INIZIALIZZAZIONE SICURA DEI FILE
function inizializzaFile() {
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '[]');
  if (!fs.existsSync(MENU_FILE_PATH)) fs.writeFileSync(MENU_FILE_PATH, '[]');
  if (!fs.existsSync(TAVOLI_OCCUPATI_PATH)) fs.writeFileSync(TAVOLI_OCCUPATI_PATH, '[]');
}
inizializzaFile();

// ✅ INIZIALIZZA IL LICENSE MANAGER
const licenseManager = new LicenseManager();
console.log('🔐 Sistema licenze inizializzato');

// ✅ COPERT0 ATTIVO DI DEFAULT
let coperto = { attivo: true, prezzo: 2.00 };

// --- Funzioni helper SICURE per file JSON ---
function leggiFileSicuro(path) {
  try {
    const data = fs.readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Errore lettura file ${path}:`, error);
    fs.writeFileSync(path, '[]');
    return [];
  }
}

function scriviFileSicuro(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Errore scrittura file ${path}:`, error);
    return false;
  }
}

// --- Funzioni tavoli MIGLIORATE ---
function occupaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    if (!occupati.includes(tavolo)) {
      occupati.push(tavolo);
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
      console.log(`✅ Tavolo ${tavolo} occupato - Totale: ${occupati.length}`);
    } else {
      console.log(`ℹ️ Tavolo ${tavolo} già occupato`);
    }
  } catch (error) {
    console.error('❌ Errore occupaTavolo:', error);
  }
}

function liberaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    const prima = occupati.length;
    occupati = occupati.filter(t => t.toString() !== tavolo.toString());
    const dopo = occupati.length;
    
    scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
    console.log(`✅ Tavolo ${tavolo} liberato (${prima} -> ${dopo} tavoli occupati)`);
    
    return dopo < prima;
  } catch (error) {
    console.error('❌ Errore liberaTavolo:', error);
    return false;
  }
}

// ✅ FUNZIONE PER PULIRE ORDINI VECCHI (dopo le 5:00)
function pulisciOrdiniVecchi() {
  console.log('🔍 CHIAMATA pulisciOrdiniVecchi()');
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    console.log(`📊 Ordini prima della pulizia: ${ordini.length}`);
    
    if (ordini.length === 0) {
      console.log('ℹ️ Nessun ordine da pulire');
      return ordini;
    }
    
    const oraCorrente = new Date();
    console.log('⏰ Ora corrente:', oraCorrente.toLocaleString('it-IT'));
    
    // Data di taglio: 5:00 di oggi
    const oggi5AM = new Date();
    oggi5AM.setHours(5, 0, 0, 0);
    
    // Se è prima delle 5:00, usa ieri 5:00
    const dataTaglio = oraCorrente < oggi5AM 
      ? new Date(oggi5AM.getTime() - 24 * 60 * 60 * 1000)
      : oggi5AM;
    
    console.log('⏰ Data taglio pulizia:', dataTaglio.toLocaleString('it-IT'));
    
    const ordiniFiltrati = ordini.filter(ordine => {
      if (!ordine.timestamp && !ordine.dataOra) {
        console.log('⚠️ Ordine senza timestamp:', ordine.id);
        return false;
      }
      
      const dataOrdine = new Date(ordine.timestamp || ordine.dataOra);
      
      // ✅ CONTROLLA SE LA DATA È FUTURA (errore di sistema)
      if (dataOrdine > new Date()) {
        console.log(`⚠️ Ordine ${ordine.id} con data futura: ${dataOrdine.toLocaleString('it-IT')}`);
        return false; // Elimina ordini con date future
      }
      
      const isRecente = dataOrdine >= dataTaglio;
      
      if (!isRecente) {
        console.log(`🗑️ Ordine ${ordine.id} eliminato (${dataOrdine.toLocaleString('it-IT')})`);
      }
      
      return isRecente;
    });
    
    const eliminati = ordini.length - ordiniFiltrati.length;
    
    if (eliminati > 0) {
      console.log(`🧹 PULIZIA: Eliminati ${eliminati} ordini vecchi`);
      scriviFileSicuro(FILE_PATH, ordiniFiltrati);
      
      // Reset tavoli occupati
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, []);
      console.log('✅ Tavoli occupati resettati');
    } else {
      console.log('ℹ️ Nessun ordine vecchio da eliminare');
    }
    
    console.log(`📊 Ordini dopo la pulizia: ${ordiniFiltrati.length}`);
    return ordiniFiltrati;
    
  } catch (error) {
    console.error('❌ Errore pulizia ordini:', error);
    return leggiFileSicuro(FILE_PATH);
  }
}

// ✅ ROUTES LICENZE
app.use('/api/license', licenseRoutes);

// ✅ HEALTH CHECK PUBBLICO (funziona sempre)
app.get('/api/health', (req, res) => {
  const licenseStatus = licenseManager.verifyLicense();
  
  res.json({ 
    status: 'OK', 
    server: 'Ristorante Bellavista',
    version: '2.0',
    timestamp: new Date().toISOString(),
    license: {
      valid: licenseStatus.valid,
      type: licenseStatus.license?.type,
      daysRemaining: licenseStatus.daysRemaining,
      expiry: licenseStatus.license?.expiryDate
    }
  });
});

// ✅ APPLICA CONTROLLO LICENZE A TUTTE LE ALTRE API
app.use('/api', licenseCheck);

// --- Endpoint Coperto ---
app.get('/api/coperto', (req, res) => {
  console.log('📋 Richiesta coperto ricevuta');
  res.json(coperto);
});

app.post('/api/coperto', (req, res) => {
  const { attivo, prezzo } = req.body;
  coperto = { attivo: !!attivo, prezzo: !isNaN(prezzo) ? Number(prezzo) : 0 };
  console.log('⚙️ Coperto aggiornato:', coperto);
  res.json({ success: true, coperto });
});

// --- Endpoint Ordini ---

// ✅ ORDINI ATTIVI (esclude i chiusi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini', (req, res) => {
  try {
    const ordiniPuliti = pulisciOrdiniVecchi(); // ✅ CHIAMA LA PULIZIA
    const ordiniAttivi = ordiniPuliti.filter(ordine => ordine.stato !== 'chiuso');
    console.log('📋 Richiesta ordini ATTIVI - totali:', ordiniAttivi.length);
    res.json(ordiniAttivi);
  } catch (error) {
    console.error('❌ Errore /api/ordini:', error);
    res.status(500).json({ error: 'Errore lettura ordini' });
  }
});

// ✅ ORDINI COMPLETI (anche chiusi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini/completo', (req, res) => {
  try {
    const ordini = pulisciOrdiniVecchi(); // ✅ CHIAMA LA PULIZIA
    console.log('📋 Richiesta ordini COMPLETI - totali:', ordini.length);
    res.json(ordini);
  } catch (error) {
    console.error('❌ Errore /api/ordini/completo:', error);
    res.status(500).json({ error: 'Errore lettura ordini completi' });
  }
});

// ✅ ORDINI PER TAVOLO (solo attivi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    const ordini = pulisciOrdiniVecchi(); // ✅ CHIAMA LA PULIZIA
    const ordiniTavolo = ordini.filter(o => 
      o.tavolo.toString() === tavolo && o.stato !== 'chiuso'
    );
    console.log(`📋 Ordini attivi tavolo ${tavolo}:`, ordiniTavolo.length);
    res.json(ordiniTavolo);
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore lettura ordini tavolo' });
  }
});

app.post('/api/ordina', (req, res) => {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = req.body;
    
    if (!ordine.tavolo || !ordine.ordinazione) {
      return res.status(400).json({ error: 'Dati ordine incompleti' });
    }
    
    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
    ordine.dataOra = new Date().toLocaleString('it-IT');
    
    console.log('📦 Nuovo ordine:', {
      tavolo: ordine.tavolo,
      items: ordine.ordinazione.length,
      data: ordine.dataOra
    });
    
    ordini.push(ordine);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore salvataggio ordine' });
    }
    
    occupaTavolo(ordine.tavolo);
    res.json({ 
      message: 'Ordine ricevuto con successo', 
      printed: true,
      id: ordine.id 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordina:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/ordini/:id/evaso', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const index = ordini.findIndex(o => o.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    
    ordini[index].stato = 'evaso';
    ordini[index].evasoIl = new Date().toISOString();
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordine' });
    }
    
    console.log('✅ Ordine evaso:', id);
    res.json({ message: 'Ordine evaso' });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/:id/evaso:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT DELETE PER CHIUDERE TAVOLO - MARCHIA COME CHIUSO
app.delete('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    console.log(`🔄 Closing table ${tavolo}...`);
    
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo);
    
    // ✅ SEGNA GLI ORDINI COME "CHIUSO" - NON ELIMINARLI
    let updatedCount = 0;
    ordini = ordini.map(ordine => {
      if (ordine.tavolo.toString() === tavolo && ordine.stato !== 'chiuso') {
        updatedCount++;
        return {
          ...ordine,
          stato: 'chiuso',
          chiusoIl: new Date().toLocaleString('it-IT')
        };
      }
      return ordine;
    });
    
    console.log(`✅ Marked ${updatedCount} orders as closed`);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordini' });
    }
    
    // ✅ LIBERA IL TAVOLO
    liberaTavolo(tavolo);
    
    console.log(`✅ Table ${tavolo} closed successfully - Orders closed: ${updatedCount}`);
    res.json({ 
      message: 'Table closed successfully', 
      ordiniChiusi: updatedCount 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Tavoli occupati ---
app.get('/api/tavoli/occupati', (req, res) => {
  try {
    const occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    console.log('📋 Tavoli occupati richiesti:', occupati);
    res.json(occupati);
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupati:', error);
    res.status(500).json({ error: 'Errore lettura tavoli occupati' });
  }
});

app.post('/api/tavoli/occupa', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    occupaTavolo(tavolo);
    console.log('📍 Tavolo occupato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} occupato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupa:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/tavoli/libera', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    liberaTavolo(tavolo);
    console.log('✅ Tavolo liberato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} liberato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/libera:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Menu ---
app.get('/api/menu', (req, res) => {
  try {
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    console.log('📋 Richiesta menu - prodotti:', menu.length);
    res.json(menu);
  } catch (error) {
    console.error('❌ Errore /api/menu:', error);
    res.status(500).json({ error: 'Errore lettura menu' });
  }
});

app.post('/api/menu', (req, res) => {
  try {
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const nuovoProdotto = req.body;
    nuovoProdotto.id = Date.now();
    menu.push(nuovoProdotto);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore salvataggio menu' });
    }
    
    console.log('✅ Prodotto aggiunto:', nuovoProdotto.nome);
    res.json({ message: 'Prodotto aggiunto', id: nuovoProdotto.id });
    
  } catch (error) {
    console.error('❌ Errore /api/menu POST:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Modifica prodotto ---
app.put('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const index = menu.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Prodotto non trovato' });

    menu[index] = { ...menu[index], ...req.body };
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore aggiornamento menu' });
    }
    
    console.log('✅ Prodotto modificato:', menu[index].nome);
    res.json({ message: 'Prodotto modificato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id PUT:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina prodotto ---
app.delete('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodotto = menu.find(p => p.id === id);
    menu = menu.filter(p => p.id !== id);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione prodotto' });
    }
    
    console.log('✅ Prodotto eliminato:', prodotto?.nome);
    res.json({ message: 'Prodotto eliminato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id DELETE:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina categoria ---
app.delete('/api/categoria/:categoria', (req, res) => {
  try {
    const cat = req.params.categoria;
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodottiEliminati = menu.filter(p => p.categoria === cat);
    menu = menu.filter(p => p.categoria !== cat);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione categoria' });
    }
    
    console.log('✅ Categoria eliminata:', cat, '- Prodotti:', prodottiEliminati.length);
    res.json({ 
      message: `Categoria "${cat}" eliminata`, 
      prodottiEliminati: prodottiEliminati.length 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/categoria/:categoria:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT PER PULIZIA FORZATA (sviluppo)
app.post('/api/ordini/pulizia-forzata', (req, res) => {
  try {
    console.log('🧹 AVVIO PULIZIA FORZATA...');
    const ordiniPrima = leggiFileSicuro(FILE_PATH).length;
    
    const ordiniDopo = pulisciOrdiniVecchi();
    
    res.json({
      success: true,
      message: 'Pulizia forzata completata',
      prima: ordiniPrima,
      dopo: ordiniDopo.length,
      eliminati: ordiniPrima - ordiniDopo.length
    });
  } catch (error) {
    console.error('❌ Errore pulizia forzata:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Gestione errori globale ---
app.use((err, req, res, next) => {
  console.error('❌ Errore server:', err);
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message 
  });
});

// ✅ 404 handler CORRETTO
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint non trovato',
    path: req.path,
    method: req.method
  });
});

// --- Avvio server ---
const PORT = 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🍕 SERVER RISTORANTE BELLAVISTA - SISTEMA LICENZE ATTIVO');
  console.log('📍 Server avviato su:', `http://${HOST}:${PORT}`);
  console.log('🔐 Sistema licenze: ATTIVO');
  console.log('📋 Endpoints licenza:');
  console.log('   GET  /api/license/status    - Stato licenza');
  console.log('   POST /api/license/trial     - Attiva trial');
  console.log('   POST /api/license/activate  - Attiva licenza');
  console.log('-----------------------------------');
  
  // Verifica licenza all'avvio
  const licenseStatus = licenseManager.verifyLicense();
  console.log('📄 Stato licenza iniziale:', licenseStatus.valid ? 'VALIDO' : 'NON VALIDO');
  if (licenseStatus.valid) {
    console.log(`   Tipo: ${licenseStatus.type} - Giorni rimanenti: ${licenseStatus.daysRemaining}`);
  } else {
    console.log(`   Motivo: ${licenseStatus.reason}`);
  }
  
  console.log('🧹 Pulizia automatica ordini attivata (5:00 ogni giorno)');
});


*/












// SERVER CON STAMPA TOTALE CON IL PREZZO E SENZA PREZZO



const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const escpos = require('escpos');
escpos.Network = require('escpos-network');
const { licenseCheck, licenseInfo } = require('./license-middleware');
const licenseRoutes = require('./license-routes');
const LicenseManager = require('./license-manager');

const app = express();
app.use(cors());
app.use(express.json());

const FILE_PATH = './ordini.json';
const MENU_FILE_PATH = './menu.json';
const TAVOLI_OCCUPATI_PATH = './tavoliOccupati.json';

// ✅ INIZIALIZZAZIONE SICURA DEI FILE
function inizializzaFile() {
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '[]');
  if (!fs.existsSync(MENU_FILE_PATH)) fs.writeFileSync(MENU_FILE_PATH, '[]');
  if (!fs.existsSync(TAVOLI_OCCUPATI_PATH)) fs.writeFileSync(TAVOLI_OCCUPATI_PATH, '[]');
}
inizializzaFile();

// ✅ INIZIALIZZA IL LICENSE MANAGER
const licenseManager = new LicenseManager();
console.log('🔐 Sistema licenze inizializzato');

// ✅ COPERT0 ATTIVO DI DEFAULT
let coperto = { attivo: true, prezzo: 2.00 };

// --- Funzioni helper SICURE per file JSON ---
function leggiFileSicuro(path) {
  try {
    const data = fs.readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Errore lettura file ${path}:`, error);
    fs.writeFileSync(path, '[]');
    return [];
  }
}

function scriviFileSicuro(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`❌ Errore scrittura file ${path}:`, error);
    return false;
  }
}

// --- Funzioni tavoli MIGLIORATE ---
function occupaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    
    if (!occupati.includes(tavolo)) {
      occupati.push(tavolo);
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
      console.log(`✅ Tavolo ${tavolo} occupato - Totale: ${occupati.length}`);
    } else {
      console.log(`ℹ️ Tavolo ${tavolo} già occupato`);
    }
  } catch (error) {
    console.error('❌ Errore occupaTavolo:', error);
  }
}

function liberaTavolo(tavolo) {
  try {
    let occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    const prima = occupati.length;
    occupati = occupati.filter(t => t.toString() !== tavolo.toString());
    const dopo = occupati.length;
    
    scriviFileSicuro(TAVOLI_OCCUPATI_PATH, occupati);
    console.log(`✅ Tavolo ${tavolo} liberato (${prima} -> ${dopo} tavoli occupati)`);
    
    return dopo < prima;
  } catch (error) {
    console.error('❌ Errore liberaTavolo:', error);
    return false;
  }
}

// ✅ FUNZIONE PER PULIRE ORDINI VECCHI (dopo le 5:00)
function pulisciOrdiniVecchi() {
  console.log('🔍 CHIAMATA pulisciOrdiniVecchi()');
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    console.log(`📊 Ordini prima della pulizia: ${ordini.length}`);
    
    if (ordini.length === 0) {
      console.log('ℹ️ Nessun ordine da pulire');
      return ordini;
    }
    
    const oraCorrente = new Date();
    console.log('⏰ Ora corrente:', oraCorrente.toLocaleString('it-IT'));
    
    // Data di taglio: 5:00 di oggi
    const oggi5AM = new Date();
    oggi5AM.setHours(5, 0, 0, 0);
    
    // Se è prima delle 5:00, usa ieri 5:00
    const dataTaglio = oraCorrente < oggi5AM 
      ? new Date(oggi5AM.getTime() - 24 * 60 * 60 * 1000)
      : oggi5AM;
    
    console.log('⏰ Data taglio pulizia:', dataTaglio.toLocaleString('it-IT'));
    
    const ordiniFiltrati = ordini.filter(ordine => {
      if (!ordine.timestamp && !ordine.dataOra) {
        console.log('⚠️ Ordine senza timestamp:', ordine.id);
        return false;
      }
      
      const dataOrdine = new Date(ordine.timestamp || ordine.dataOra);
      
      // ✅ CONTROLLA SE LA DATA È FUTURA (errore di sistema)
      if (dataOrdine > new Date()) {
        console.log(`⚠️ Ordine ${ordine.id} con data futura: ${dataOrdine.toLocaleString('it-IT')}`);
        return false; // Elimina ordini con date future
      }
      
      const isRecente = dataOrdine >= dataTaglio;
      
      if (!isRecente) {
        console.log(`🗑️ Ordine ${ordine.id} eliminato (${dataOrdine.toLocaleString('it-IT')})`);
      }
      
      return isRecente;
    });
    
    const eliminati = ordini.length - ordiniFiltrati.length;
    
    if (eliminati > 0) {
      console.log(`🧹 PULIZIA: Eliminati ${eliminati} ordini vecchi`);
      scriviFileSicuro(FILE_PATH, ordiniFiltrati);
      
      // Reset tavoli occupati
      scriviFileSicuro(TAVOLI_OCCUPATI_PATH, []);
      console.log('✅ Tavoli occupati resettati');
    } else {
      console.log('ℹ️ Nessun ordine vecchio da eliminare');
    }
    
    console.log(`📊 Ordini dopo la pulizia: ${ordiniFiltrati.length}`);
    return ordiniFiltrati;
    
  } catch (error) {
    console.error('❌ Errore pulizia ordini:', error);
    return leggiFileSicuro(FILE_PATH);
  }
}

// ✅ FUNZIONE STAMPA ORDINE SENZA PREZZI
function stampaOrdine(ordine) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordine.ipStampante || '172.20.10.8';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Errore connessione stampante:', err);
        return reject(err);
      }
      
      console.log('🖨️ Stampa ordine SENZA prezzi per tavolo:', ordine.tavolo);
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('RISTORANTE BELLAVISTA')
        .text('----------------------')
        .align('lt')
        .style('normal')
       
        .text(`TAVOLO: ${ordine.tavolo}`)
        .size(0, 1)
        .text(`DATA: ${new Date().toLocaleString()}`)
         .size(1, 1)
        .text('------------------------')
        .text('ORDINE:')
        .text('');
      
      // ✅ STAMPA SENZA PREZZI
      ordine.ordinazione.forEach((item, index) => {
        if (item.prodotto.includes('Coperto')) {
          printer.text(`${item.prodotto}`);
        } else {
          printer.text(`${item.quantità} x ${item.prodotto}`);
        }
      });
      
      printer
        .text('-----------------------')
        .text('')
        .text('')
        .text('')
        .cut()
        .close();
      
      console.log('✅ Stampa ordine completata per tavolo:', ordine.tavolo);
      resolve();
    });
  });
}









// ✅ FUNZIONE STAMPA ORDINE SENZA PREZZI
function stampaOrdine(ordine) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordine.ipStampante || '172.20.10.8';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Errore connessione stampante:', err);
        return reject(err);
      }
      
      console.log('🖨️ Stampa ordine SENZA prezzi per tavolo:', ordine.tavolo);
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 1)
        .text('RISTORANTE BELLAVISTA')
        .text('----------------------')
        .align('lt')
        .style('normal')
       
        .text(`TAVOLO: ${ordine.tavolo}`)
        .size(0, 1)
        .text(`DATA: ${new Date().toLocaleString()}`)
         .size(1, 1)
        .text('------------------------')
        .text('ORDINE:')
        .text('');
      
      // ✅ STAMPA SENZA PREZZI
      ordine.ordinazione.forEach((item, index) => {
        if (item.prodotto.includes('Coperto')) {
          printer.text(`${item.prodotto}`);
        } else {
          printer.text(`${item.quantità} x ${item.prodotto}`);
        }
      });
      
      printer
        .text('-----------------------')
        .text('')
        .text('')
        .text('')
        .cut()
        .close();
      
      console.log('✅ Stampa ordine completata per tavolo:', ordine.tavolo);
      resolve();
    });
  });
}


// ✅ FUNZIONE STAMPA TOTALE TAVOLO CON PREZZI - VERSIONE CORRETTA
function stampaTotaleTavolo(ordiniTavolo, tavolo) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordiniTavolo[0]?.ipStampante || '172.20.10.8';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Errore connessione stampante:', err);
        return reject(err);
      }
      
      console.log('💰 Stampa totale CON prezzi per tavolo:', tavolo);
      
      // Calcola il totale
      const totale = ordiniTavolo.reduce((totale, ordine) => {
        const totaleOrdine = ordine.ordinazione.reduce((sum, item) => {
          return sum + (item.prezzo * item.quantità);
        }, 0);
        return totale + totaleOrdine;
      }, 0);
      
      printer
        .font('a')
        .align('ct')
        .style('b')
        .size(1, 0)
        .text('RISTORANTE BELLAVISTA')
        .text('----------------------')
        .align('lt')
        .style('normal')
        .text(`TAVOLO: ${tavolo}`)
        .size(0, 0)
        .text(`DATA: ${new Date().toLocaleString()}`)
        .text('----------------------')
        .text('CONTO FINALE:')
        .size(0, 0)
        .text('');
      
      // ✅ STAMPA CON PREZZI - VERSIONE CORRETTA
      ordiniTavolo.forEach((ordine, ordineIndex) => {
        printer.text(`--- Ordine ${ordineIndex + 1} ---`);
        
        ordine.ordinazione.forEach((item, itemIndex) => {
          const maxLineLength = 32; // Lunghezza massima della linea per stampante termica
          
          if (item.prodotto.includes('Coperto')) {
            const prodottoText = `${item.prodotto}`;
            const prezzoText = `euro ${item.prezzo.toFixed(2)}`;
            
            // Calcola spazi necessari per allineamento
            const spaziNecessari = maxLineLength - (prodottoText.length + prezzoText.length);
            const spazi = ' '.repeat(Math.max(1, spaziNecessari));
            
            printer.text(prodottoText + spazi + prezzoText);
          } else {
            const subtotale = item.prezzo * item.quantità;
            const prodottoText = `${item.quantità} x ${item.prodotto}`;
            const prezzoText = `euro ${subtotale.toFixed(2)}`;
            
            // Calcola spazi necessari per allineamento
            const spaziNecessari = maxLineLength - (prodottoText.length + prezzoText.length);
            const spazi = ' '.repeat(Math.max(1, spaziNecessari));
            
            printer.text(prodottoText + spazi + prezzoText);
          }
        });
        
        const totaleOrdine = ordine.ordinazione.reduce((sum, item) => 
          sum + (item.prezzo * item.quantità), 0);
        
        printer
          .text('---')
          .style('b')
          .align('rt')
          .text(`Totale ordine: euro ${totaleOrdine.toFixed(2)}`)
          .align('lt')
          .style('normal')
          .text('');
      });
      
      printer
        .text('===============================================')
        .style('b')
        .size(0, 1)
        .align('rt')
        .text(`TOTALE TAVOLO: euro ${totale.toFixed(2)}`)
        .align('lt')
        .style('normal')
        .size(0, 0)
        .text('')
        .text('===============================================')
        .text('')
        .align('ct')
        .style('b')
        .text('Ritirare lo scontrino alla cassa')
        .text('')
        .text('Grazie e arrivederci!')
        .text('')
        .text('')
        .cut()
        .close();
      
      console.log('✅ Stampa totale completata per tavolo:', tavolo);
      resolve();
    });
  });
}


// ✅ ROUTES LICENZE
app.use('/api/license', licenseRoutes);

// ✅ HEALTH CHECK PUBBLICO (funziona sempre)
app.get('/api/health', (req, res) => {
  const licenseStatus = licenseManager.verifyLicense();
  
  res.json({ 
    status: 'OK', 
    server: 'Ristorante Bellavista',
    version: '2.0',
    timestamp: new Date().toISOString(),
    license: {
      valid: licenseStatus.valid,
      type: licenseStatus.license?.type,
      daysRemaining: licenseStatus.daysRemaining,
      expiry: licenseStatus.license?.expiryDate
    }
  });
});


// ✅ ENDPOINT KEEP-ALIVE SEMPLICE
app.get('/api/keep-alive', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server attivo',
    timestamp: new Date().toLocaleString('it-IT')
  });
});


// ✅ APPLICA CONTROLLO LICENZE A TUTTE LE ALTRE API
app.use('/api', licenseCheck);

// --- Endpoint Coperto ---
app.get('/api/coperto', (req, res) => {
  console.log('📋 Richiesta coperto ricevuta');
  res.json(coperto);
});

app.post('/api/coperto', (req, res) => {
  const { attivo, prezzo } = req.body;
  coperto = { attivo: !!attivo, prezzo: !isNaN(prezzo) ? Number(prezzo) : 0 };
  console.log('⚙️ Coperto aggiornato:', coperto);
  res.json({ success: true, coperto });
});










// --- Endpoint Ordini ---

// ✅ ORDINI ATTIVI (esclude i chiusi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini', (req, res) => {
  try {
    const ordiniPuliti = pulisciOrdiniVecchi(); // ✅ CHIAMA LA PULIZIA
    const ordiniAttivi = ordiniPuliti.filter(ordine => ordine.stato !== 'chiuso');
    console.log('📋 Richiesta ordini ATTIVI - totali:', ordiniAttivi.length);
    res.json(ordiniAttivi);
  } catch (error) {
    console.error('❌ Errore /api/ordini:', error);
    res.status(500).json({ error: 'Errore lettura ordini' });
  }
});

// ✅ ORDINI COMPLETI (anche chiusi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini/completo', (req, res) => {
  try {
    const ordini = pulisciOrdiniVecchi(); // ✅ CHIAMA LA PULIZIA
    console.log('📋 Richiesta ordini COMPLETI - totali:', ordini.length);
    res.json(ordini);
  } catch (error) {
    console.error('❌ Errore /api/ordini/completo:', error);
    res.status(500).json({ error: 'Errore lettura ordini completi' });
  }
});

// ✅ ORDINI PER TAVOLO (solo attivi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    const ordini = pulisciOrdiniVecchi(); // ✅ CHIAMA LA PULIZIA
    const ordiniTavolo = ordini.filter(o => 
      o.tavolo.toString() === tavolo && o.stato !== 'chiuso'
    );
    console.log(`📋 Ordini attivi tavolo ${tavolo}:`, ordiniTavolo.length);
    res.json(ordiniTavolo);
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore lettura ordini tavolo' });
  }
});

app.post('/api/ordina', (req, res) => {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = req.body;
    
    if (!ordine.tavolo || !ordine.ordinazione) {
      return res.status(400).json({ error: 'Dati ordine incompleti' });
    }
    
    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
    ordine.dataOra = new Date().toLocaleString('it-IT');
    
    console.log('📦 Nuovo ordine:', {
      tavolo: ordine.tavolo,
      items: ordine.ordinazione.length,
      data: ordine.dataOra
    });
    
    ordini.push(ordine);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore salvataggio ordine' });
    }
    
    occupaTavolo(ordine.tavolo);

    // ✅ STAMPA ORDINE SENZA PREZZI
    stampaOrdine(ordine)
      .then(() => {
        console.log('✅ Ordine stampato per tavolo:', ordine.tavolo);
      })
      .catch(err => {
        console.error('❌ Errore stampa:', err);
      });
    
    res.json({ 
      message: 'Ordine ricevuto con successo', 
      printed: true,
      id: ordine.id 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordina:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/ordini/:id/evaso', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const index = ordini.findIndex(o => o.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Ordine non trovato' });
    }
    
    ordini[index].stato = 'evaso';
    ordini[index].evasoIl = new Date().toISOString();
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordine' });
    }
    
    console.log('✅ Ordine evaso:', id);
    res.json({ message: 'Ordine evaso' });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/:id/evaso:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT DELETE PER CHIUDERE TAVOLO - MARCHIA COME CHIUSO
app.delete('/api/ordini/tavolo/:tavolo', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    console.log(`🔄 Closing table ${tavolo}...`);
    
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo);
    
    // ✅ SEGNA GLI ORDINI COME "CHIUSO" - NON ELIMINARLI
    let updatedCount = 0;
    ordini = ordini.map(ordine => {
      if (ordine.tavolo.toString() === tavolo && ordine.stato !== 'chiuso') {
        updatedCount++;
        return {
          ...ordine,
          stato: 'chiuso',
          chiusoIl: new Date().toLocaleString('it-IT')
        };
      }
      return ordine;
    });
    
    console.log(`✅ Marked ${updatedCount} orders as closed`);
    
    if (!scriviFileSicuro(FILE_PATH, ordini)) {
      return res.status(500).json({ error: 'Errore aggiornamento ordini' });
    }
    
    // ✅ LIBERA IL TAVOLO
    liberaTavolo(tavolo);
    
    console.log(`✅ Table ${tavolo} closed successfully - Orders closed: ${updatedCount}`);
    res.json({ 
      message: 'Table closed successfully', 
      ordiniChiusi: updatedCount 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordini/tavolo/:tavolo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT PER STAMPA TOTALE TAVOLO
app.post('/api/tavoli/:tavolo/stampa-totale', (req, res) => {
  try {
    const tavolo = req.params.tavolo;
    const ordini = leggiFileSicuro(FILE_PATH);
    
    const ordiniTavolo = ordini.filter(o => 
      o.tavolo.toString() === tavolo && o.stato !== 'chiuso'
    );
    
    if (ordiniTavolo.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Nessun ordine attivo per il tavolo ${tavolo}` 
      });
    }
    
    console.log(`🖨️ Richiesta stampa totale tavolo ${tavolo} - ordini:`, ordiniTavolo.length);
    
    stampaTotaleTavolo(ordiniTavolo, tavolo)
      .then(() => {
        res.json({ 
          success: true, 
          message: `Totale tavolo ${tavolo} stampato con successo`,
          ordini: ordiniTavolo.length,
          totale: ordiniTavolo.reduce((tot, ord) => tot + ord.ordinazione.reduce((sum, item) => 
            sum + (item.prezzo * item.quantità), 0), 0)
        });
      })
      .catch(err => {
        console.error('❌ Errore stampa totale:', err);
        res.status(500).json({ 
          success: false, 
          error: 'Errore durante la stampa del totale' 
        });
      });
      
  } catch (error) {
    console.error('❌ Errore /api/tavoli/:tavolo/stampa-totale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

// --- Tavoli occupati ---
app.get('/api/tavoli/occupati', (req, res) => {
  try {
    const occupati = leggiFileSicuro(TAVOLI_OCCUPATI_PATH);
    console.log('📋 Tavoli occupati richiesti:', occupati);
    res.json(occupati);
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupati:', error);
    res.status(500).json({ error: 'Errore lettura tavoli occupati' });
  }
});

app.post('/api/tavoli/occupa', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    occupaTavolo(tavolo);
    console.log('📍 Tavolo occupato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} occupato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/occupa:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/tavoli/libera', (req, res) => {
  try {
    const { tavolo } = req.body;
    if (!tavolo) {
      return res.status(400).json({ message: 'Table number missing' });
    }
    
    liberaTavolo(tavolo);
    console.log('✅ Tavolo liberato via API:', tavolo);
    res.json({ message: `Tavolo ${tavolo} liberato` });
    
  } catch (error) {
    console.error('❌ Errore /api/tavoli/libera:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Menu ---
app.get('/api/menu', (req, res) => {
  try {
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    console.log('📋 Richiesta menu - prodotti:', menu.length);
    res.json(menu);
  } catch (error) {
    console.error('❌ Errore /api/menu:', error);
    res.status(500).json({ error: 'Errore lettura menu' });
  }
});

app.post('/api/menu', (req, res) => {
  try {
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const nuovoProdotto = req.body;
    nuovoProdotto.id = Date.now();
    menu.push(nuovoProdotto);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore salvataggio menu' });
    }
    
    console.log('✅ Prodotto aggiunto:', nuovoProdotto.nome);
    res.json({ message: 'Prodotto aggiunto', id: nuovoProdotto.id });
    
  } catch (error) {
    console.error('❌ Errore /api/menu POST:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Modifica prodotto ---
app.put('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const index = menu.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ message: 'Prodotto non trovato' });

    menu[index] = { ...menu[index], ...req.body };
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore aggiornamento menu' });
    }
    
    console.log('✅ Prodotto modificato:', menu[index].nome);
    res.json({ message: 'Prodotto modificato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id PUT:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina prodotto ---
app.delete('/api/menu/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodotto = menu.find(p => p.id === id);
    menu = menu.filter(p => p.id !== id);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione prodotto' });
    }
    
    console.log('✅ Prodotto eliminato:', prodotto?.nome);
    res.json({ message: 'Prodotto eliminato' });
    
  } catch (error) {
    console.error('❌ Errore /api/menu/:id DELETE:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- Elimina categoria ---
app.delete('/api/categoria/:categoria', (req, res) => {
  try {
    const cat = req.params.categoria;
    let menu = leggiFileSicuro(MENU_FILE_PATH);
    const prodottiEliminati = menu.filter(p => p.categoria === cat);
    menu = menu.filter(p => p.categoria !== cat);
    
    if (!scriviFileSicuro(MENU_FILE_PATH, menu)) {
      return res.status(500).json({ error: 'Errore eliminazione categoria' });
    }
    
    console.log('✅ Categoria eliminata:', cat, '- Prodotti:', prodottiEliminati.length);
    res.json({ 
      message: `Categoria "${cat}" eliminata`, 
      prodottiEliminati: prodottiEliminati.length 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/categoria/:categoria:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT PER PULIZIA FORZATA (sviluppo)
app.post('/api/ordini/pulizia-forzata', (req, res) => {
  try {
    console.log('🧹 AVVIO PULIZIA FORZATA...');
    const ordiniPrima = leggiFileSicuro(FILE_PATH).length;
    
    const ordiniDopo = pulisciOrdiniVecchi();
    
    res.json({
      success: true,
      message: 'Pulizia forzata completata',
      prima: ordiniPrima,
      dopo: ordiniDopo.length,
      eliminati: ordiniPrima - ordiniDopo.length
    });
  } catch (error) {
    console.error('❌ Errore pulizia forzata:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Gestione errori globale ---
app.use((err, req, res, next) => {
  console.error('❌ Errore server:', err);
  res.status(500).json({ 
    error: 'Errore interno del server',
    message: err.message 
  });
});

// ✅ 404 handler CORRETTO
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint non trovato',
    path: req.path,
    method: req.method
  });
});

// --- Avvio server ---
const PORT = 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🍕 SERVER RISTORANTE BELLAVISTA - SISTEMA LICENZE ATTIVO');
  console.log('📍 Server avviato su:', `http://${HOST}:${PORT}`);
  console.log('🔐 Sistema licenze: ATTIVO');
  console.log('📋 Endpoints licenza:');
  console.log('   GET  /api/license/status    - Stato licenza');
  console.log('   POST /api/license/trial     - Attiva trial');
  console.log('   POST /api/license/activate  - Attiva licenza');
  console.log('-----------------------------------');
  
  // Verifica licenza all'avvio
  const licenseStatus = licenseManager.verifyLicense();
  console.log('📄 Stato licenza iniziale:', licenseStatus.valid ? 'VALIDO' : 'NON VALIDO');
  if (licenseStatus.valid) {
    console.log(`   Tipo: ${licenseStatus.type} - Giorni rimanenti: ${licenseStatus.daysRemaining}`);
  } else {
    console.log(`   Motivo: ${licenseStatus.reason}`);
  }
  
  console.log('🧹 Pulizia automatica ordini attivata (5:00 ogni giorno)');
  console.log('🖨️ Sistema stampa doppia modalità attivato');
});
















