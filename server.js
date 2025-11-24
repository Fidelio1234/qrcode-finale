// SERVER CON STAMPA TOTALE CON IL PREZZO E SENZA PREZZO



/*const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const escpos = require('escpos');
escpos.Network = require('escpos-network');
const { licenseCheck, licenseInfo } = require('./license-middleware');
const licenseRoutes = require('./license-routes');
const LicenseManager = require('./license-manager');

const app = express();

// ✅ CORS SPECIFICO PER VERCEL
app.use(cors({
  origin: [
    'https://frontend-qrcode-psi.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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




























// ✅ FUNZIONE STAMPA TOTALE TAVOLO CON PREZZI - VERSIONE CORRETTA
function stampaTotaleTavolo(ordiniTavolo, tavolo) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordiniTavolo[0]?.ipStampante || '172.20.10.8';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        // ✅ MODIFICA: RISOLVI INVECE DI RIGETTARE!
        console.error('❌ Stampante non raggiungibile da Render:', err.message);
        console.log('📍 Totale NON stampato - verrà stampato localmente');
        return resolve(); // ⬅️ IMPORTANTE: resolve() invece di reject()
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













// ✅ AGGIUNGI QUESTO PRIMA DI "// ✅ AVVIO SERVER"
app.post('/api/stampa-remota', async (req, res) => {
  try {
    const { ordine } = req.body;
    
    console.log('🌐 ORDINE REMOTO RICEVUTO - Tavolo:', ordine.tavolo);
    
    // 1. SALVA L'ORDINE NEL DATABASE
    let ordini = leggiFileSicuro(FILE_PATH);
    ordine.id = Date.now();
    ordine.timestamp = new Date().toISOString();
    ordine.stato = 'in_attesa';
    ordini.push(ordine);
    scriviFileSicuro(FILE_PATH, ordini);
    
    // 2. INVIA ALLA STAMPANTE LOCALE DEL RISTORANTE
    const IP_STAMPANTE = '172.20.10.2'; // IL PC DEL RISTORANTE
    console.log('🔔 Invio a stampante locale:', IP_STAMPANTE);
    
    const response = await fetch(`http://${IP_STAMPANTE}:3002/api/stampa-ordine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordine }),
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('✅ Ordine stampato localmente!');
      res.json({ 
        success: true, 
        message: 'Ordine stampato in cucina!',
        id: ordine.id 
      });
    } else {
      throw new Error(`Stampa fallita: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Errore stampa remota:', error.message);
    
    // L'ORDINE È COMUNQUE SALVATO!
    res.json({ 
      success: false, 
      message: 'Ordine ricevuto! Stampante momentaneamente non disponibile.',
      error: error.message
    });
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
    
    // Calcola il totale per la risposta
    const totale = ordiniTavolo.reduce((tot, ord) => tot + ord.ordinazione.reduce((sum, item) => 
      sum + (item.prezzo * item.quantità), 0), 0);
    
    // ✅ TENTATIVO DI STAMPA (ma non blocca se fallisce)
    stampaTotaleTavolo(ordiniTavolo, tavolo)
      .then(() => {
        console.log('✅ Stampa totale completata da Render');
        res.json({ 
          success: true, 
          message: `Totale tavolo ${tavolo} stampato con successo`,
          ordini: ordiniTavolo.length,
          totale: totale
        });
      })
      .catch(err => {
        console.log('📍 Stampa totale fallita da Render');
        res.json({ 
          success: true, 
          message: `Totale tavolo ${tavolo} calcolato (stampa locale richiesta)`,
          ordini: ordiniTavolo.length,
          totale: totale,
          note: 'Stampante non raggiungibile da cloud'
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










// ✅ ENDPOINT STAMPA REMOTA
app.post('/api/stampa-remota', async (req, res) => {
  try {
    const { ordine } = req.body;
    
    console.log('🌐 ORDINE REMOTO RICEVUTO - Tavolo:', ordine.tavolo);
    
    // 1. SALVA L'ORDINE NEL DATABASE
    let ordini = leggiFileSicuro(FILE_PATH);
    ordine.id = Date.now();
    ordine.timestamp = new Date().toISOString();
    ordine.stato = 'in_attesa';
    ordini.push(ordine);
    scriviFileSicuro(FILE_PATH, ordini);
    
    // 2. INVIA ALLA STAMPANTE LOCALE DEL RISTORANTE
    const IP_STAMPANTE = '172.20.10.2'; // IL PC DEL RISTORANTE
    console.log('🔔 Invio a stampante locale:', IP_STAMPANTE);
    
    const response = await fetch(`http://${IP_STAMPANTE}:3002/api/stampa-ordine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordine }),
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('✅ Ordine stampato localmente!');
      res.json({ 
        success: true, 
        message: 'Ordine stampato in cucina!',
        id: ordine.id 
      });
    } else {
      throw new Error(`Stampa fallita: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Errore stampa remota:', error.message);
    
    // L'ORDINE È COMUNQUE SALVATO!
    res.json({ 
      success: false, 
      message: 'Ordine ricevuto! Stampante momentaneamente non disponibile.',
      error: error.message
    });
  }
});

















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

app.get('/api/keep-alive', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servizio stampante attivo',
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

    // ⬅️ QUI AGGIUNGI I PREZZI
    ordine.ordinazione = applicaPrezzi(ordine.ordinazione);

    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
    ordine.dataOra = new Date().toLocaleString('it-IT');
    
    ordini.push(ordine);
    scriviFileSicuro(FILE_PATH, ordini)
    
    occupaTavolo(ordine.tavolo);

    stampaOrdine(ordine);
    
    res.json({ 
      message: 'Ordine ricevuto con successo!', 
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



// ✅ NEL TUO SERVER SU RENDER

// GET - Ordini non stampati
app.get('/api/ordini/non-stampati', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    const nonStampati = ordini.filter(o => o.stato === 'in_attesa' && !o.stampato);
    console.log(`📋 Richiesta ordini non stampati: ${nonStampati.length} trovati`);
    res.json(nonStampati);
  } catch (error) {
    console.error('❌ Errore /api/ordini/non-stampati:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Marca come stampato
app.post('/api/ordini/:id/stampato', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = ordini.find(o => o.id === id);
    
    if (ordine) {
      ordine.stampato = true;
      ordine.stampatoIl = new Date().toISOString();
      scriviFileSicuro(FILE_PATH, ordini);
      console.log('✅ Ordine marcato come stampato:', id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Errore /api/ordini/:id/stampato:', error);
    res.status(500).json({ error: error.message });
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


*/








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

// ✅ CORS SPECIFICO PER VERCEL
app.use(cors({
  origin: [
    'https://frontend-qrcode-psi.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// ✅ FUNZIONE APPLICA PREZZI (MANCANTE NEL CODICE ORIGINALE)
function applicaPrezzi(ordinazione) {
  try {
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    
    return ordinazione.map(item => {
      if (item.prodotto.includes('Coperto')) {
        return {
          ...item,
          prezzo: coperto.prezzo
        };
      }
      
      // Trova il prodotto nel menu per ottenere il prezzo
      const prodottoMenu = menu.find(p => p.nome === item.prodotto);
      if (prodottoMenu) {
        return {
          ...item,
          prezzo: prodottoMenu.prezzo
        };
      }
      
      // Se non trova il prodotto, mantieni il prezzo esistente o imposta 0
      return {
        ...item,
        prezzo: item.prezzo || 0
      };
    });
  } catch (error) {
    console.error('❌ Errore applicaPrezzi:', error);
    return ordinazione;
  }
}

// ✅ FUNZIONE STAMPA TOTALE TAVOLO - INVIA AL SERVER LOCALE
function stampaTotaleTavolo(ordiniTavolo, tavolo) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('💰 Preparazione totale per stampa locale - Tavolo:', tavolo);
      
      // Calcola il totale
      const totale = ordiniTavolo.reduce((totale, ordine) => {
        const totaleOrdine = ordine.ordinazione.reduce((sum, item) => {
          return sum + (item.prezzo * item.quantità);
        }, 0);
        return totale + totaleOrdine;
      }, 0);
      
      // ✅ INVIA AL SERVER LOCALE PER LA STAMPA
      const IP_SERVER_LOCALE = '172.20.10.2';
      
      console.log(`🔔 Invio totale tavolo ${tavolo} al server locale:`, IP_SERVER_LOCALE);
      
      const response = await fetch(`http://${IP_SERVER_LOCALE}:3002/api/stampa-conto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordini: ordiniTavolo,
          tavolo: tavolo,
          totale: totale
        }),
        timeout: 10000
      });
      
      if (response.ok) {
        console.log('✅ Totale inviato al server locale per la stampa');
        resolve();
      } else {
        throw new Error(`Server locale non disponibile: ${response.status}`);
      }
      
    } catch (error) {
      console.log('📍 Stampa totale delegata al server locale:', error.message);
      resolve(); // ✅ RISOLVI COMUNQUE - LA STAMPA AVVERRÀ LOCALMENTE
    }
  });
}




// ✅ ENDPOINT PER RECUPERO DATI TOTALE (per servizio di polling)
app.get('/api/tavoli/:tavolo/stampa-totale-locale', (req, res) => {
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
    
    // Calcola il totale
    const totale = ordiniTavolo.reduce((tot, ord) => tot + ord.ordinazione.reduce((sum, item) => 
      sum + (item.prezzo * item.quantità), 0), 0);
    
    console.log(`📊 Dati totale tavolo ${tavolo}: ${ordiniTavolo.length} ordini, €${totale.toFixed(2)}`);
    
    res.json({ 
      success: true, 
      ordini: ordiniTavolo,
      tavolo: tavolo,
      totale: totale,
      timestamp: new Date().toISOString()
    });
      
  } catch (error) {
    console.error('❌ Errore /api/tavoli/:tavolo/stampa-totale-locale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});






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

app.get('/api/keep-alive', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servizio stampante attivo',
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

// ✅ ORDINI ATTIVI (esclude i chiusi) - CON PULIZIA AUTOMATICA
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

// ✅ ORDINI COMPLETI (anche chiusi) - CON PULIZIA AUTOMATICA
app.get('/api/ordini/completo', (req, res) => {
  try {
    const ordini = pulisciOrdiniVecchi();
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
    const ordini = pulisciOrdiniVecchi();
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

// ✅ ENDPOINT ORDINA
app.post('/api/ordina', (req, res) => {
  try {
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = req.body;
    
    if (!ordine.tavolo || !ordine.ordinazione) {
      return res.status(400).json({ error: 'Dati ordine incompleti' });
    }

    // ⬅️ AGGIUNGI I PREZZI
    ordine.ordinazione = applicaPrezzi(ordine.ordinazione);

    ordine.id = Date.now();
    ordine.stato = 'in_attesa';
    ordine.timestamp = new Date().toISOString();
ordine.dataOra = new Date().toLocaleString('it-IT', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});
    ordini.push(ordine);
    scriviFileSicuro(FILE_PATH, ordini)
    
    occupaTavolo(ordine.tavolo);

    // Tenta di stampare (ma non blocca se fallisce)
   // stampaOrdine(ordine).catch(err => {
      //console.log('📍 Stampa ordine fallita, verrà gestita localmente');
   // });
    
    res.json({ 
      message: 'Ordine ricevuto con successo!', 
      printed: false,
      id: ordine.id 
    });
    
  } catch (error) {
    console.error('❌ Errore /api/ordina:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ✅ ENDPOINT EVASO
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

// ✅ ORDINI NON STAMPATI
app.get('/api/ordini/non-stampati', (req, res) => {
  try {
    const ordini = leggiFileSicuro(FILE_PATH);
    const nonStampati = ordini.filter(o => o.stato === 'in_attesa' && !o.stampato);
    console.log(`📋 Richiesta ordini non stampati: ${nonStampati.length} trovati`);
    res.json(nonStampati);
  } catch (error) {
    console.error('❌ Errore /api/ordini/non-stampati:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ MARCA COME STAMPATO
app.post('/api/ordini/:id/stampato', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let ordini = leggiFileSicuro(FILE_PATH);
    const ordine = ordini.find(o => o.id === id);
    
    if (ordine) {
      ordine.stampato = true;
      ordine.stampatoIl = new Date().toISOString();
      scriviFileSicuro(FILE_PATH, ordini);
      console.log('✅ Ordine marcato come stampato:', id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Errore /api/ordini/:id/stampato:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ ENDPOINT PER STAMPA TOTALE TAVOLO - VERSIONE MIGLIORATA
app.post('/api/tavoli/:tavolo/stampa-totale', async (req, res) => {
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
    
    // Calcola il totale per la risposta
    const totale = ordiniTavolo.reduce((tot, ord) => tot + ord.ordinazione.reduce((sum, item) => 
      sum + (item.prezzo * item.quantità), 0), 0);
    
    // ✅ TENTA DI INVIARE AL SERVER LOCALE (ma non blocca se fallisce)
    await stampaTotaleTavolo(ordiniTavolo, tavolo);
    
    res.json({ 
      success: true, 
      message: `Totale tavolo ${tavolo} inviato alla stampante locale`,
      ordini: ordiniTavolo.length,
      totale: totale
    });
      
  } catch (error) {
    console.error('❌ Errore /api/tavoli/:tavolo/stampa-totale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
});

// ✅ ENDPOINT PER FORZARE STAMPA LOCALE (usato dal servizio di polling)
app.get('/api/tavoli/:tavolo/stampa-totale-locale', (req, res) => {
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
    
    // Calcola solo il totale e restituisci i dati
    const totale = ordiniTavolo.reduce((tot, ord) => tot + ord.ordinazione.reduce((sum, item) => 
      sum + (item.prezzo * item.quantità), 0), 0);
    
    res.json({ 
      success: true, 
      ordini: ordiniTavolo,
      tavolo: tavolo,
      totale: totale
    });
      
  } catch (error) {
    console.error('❌ Errore stampa totale locale:', error);
    res.status(500).json({ success: false, error: error.message });
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

// ✅ ENDPOINT DEBUG ORA - aggiungilo al server
app.get('/api/debug-time', (req, res) => {
  const now = new Date();
  
  // Test vari formati
  const testUTCplus1 = new Date(now.getTime() + (1 * 60 * 60 * 1000));
  const testUTCplus2 = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  
  res.json({
    oraAttuale: now.toString(),
    iso: now.toISOString(),
    locale: now.toLocaleString('it-IT'),
    
    // Test con offset manuale
    UTCplus1: testUTCplus1.toLocaleString('it-IT'),
    UTCplus2: testUTCplus2.toLocaleString('it-IT'),
    
    // Test con timezone
    europeRome: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
    
    // Test formattazione specifica
    formatoItaliano: new Date().toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
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