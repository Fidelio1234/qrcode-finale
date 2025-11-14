
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
const COPERTI_PATH = './coperto.json'; 

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
    const ipStampante = ordine.ipStampante || '192.168.1.100';
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
// ✅ FUNZIONE STAMPA ORDINE SENZA PREZZI - VERSIONE CUCINA
function stampaOrdineCucina(ordine) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordine.ipStampante || '192.168.1.100';
    const device = new escpos.Network(ipStampante);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('❌ Errore connessione stampante:', err);
        return reject(err);
      }
      
      console.log('🖨️ Stampa ordine CUCINA (senza prezzi) per tavolo:', ordine.tavolo);
      
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
        .text('ORDINE CUCINA:')
        .text('');
      
      // ✅ STAMPA SENZA PREZZI PER CUCINA
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
      
      console.log('✅ Stampa CUCINA completata per tavolo:', ordine.tavolo);
      resolve();
    });
  });
}


// ✅ FUNZIONE STAMPA TOTALE TAVOLO CON PREZZI - VERSIONE CORRETTA
function stampaTotaleTavolo(ordiniTavolo, tavolo) {
  return new Promise((resolve, reject) => {
    const ipStampante = ordiniTavolo[0]?.ipStampante || '192.168.1.100';
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
    stampaOrdineCucina(ordine)
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







// ✅ DEBUG ENDPOINT - AGGIUNGI QUESTO
app.get('/api/debug/files', (req, res) => {
  try {
    const debugInfo = {
      server: 'QRCode System - Render',
      environment: process.env.NODE_ENV || 'production',
      directory: __dirname,
      timestamp: new Date().toISOString(),
      files: {
        ordini: {
          path: FILE_PATH,
          exists: fs.existsSync(FILE_PATH),
          size: fs.existsSync(FILE_PATH) ? fs.statSync(FILE_PATH).size : 0,
          content: leggiFileSicuro(FILE_PATH)
        },
        menu: {
          path: MENU_FILE_PATH,
          exists: fs.existsSync(MENU_FILE_PATH),
          size: fs.existsSync(MENU_FILE_PATH) ? fs.statSync(MENU_FILE_PATH).size : 0,
          content: leggiFileSicuro(MENU_FILE_PATH)
        },
        tavoliOccupati: {
          path: TAVOLI_OCCUPATI_PATH,
          exists: fs.existsSync(TAVOLI_OCCUPATI_PATH),
          size: fs.existsSync(TAVOLI_OCCUPATI_PATH) ? fs.statSync(TAVOLI_OCCUPATI_PATH).size : 0,
          content: leggiFileSicuro(TAVOLI_OCCUPATI_PATH)
        },
        coperto: {
          path: COPERTI_PATH,
          exists: fs.existsSync(COPERTI_PATH),
          size: fs.existsSync(COPERTI_PATH) ? fs.statSync(COPERTI_PATH).size : 0,
          content: leggiFileSicuro(COPERTI_PATH)
        }
      }
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
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


// ✅ HOME PAGE ENDPOINT - AGGIUNGI QUESTO
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Server QRCode Ristorante Bellavista - ONLINE!',
    version: '2.0',
    deployedOn: 'Render',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      menu: '/api/menu', 
      ordini: '/api/ordini',
      tavoli_occupati: '/api/tavoli/occupati',
      coperto: '/api/coperto',
      nuova_ordine: '/api/ordina (POST)',
      debug: '/api/debug/files'
    },
    license: {
      status: 'ACTIVE',
      type: 'TRIAL',
      days_remaining: 15
    }
  });
});





// ✅ ENDPOINT OPERATORE - AGGIUNGI QUESTO
app.get('/operatore', (req, res) => {
  try {
    const { tavolo } = req.query;
    
    if (!tavolo) {
      return res.status(400).json({ error: 'Numero tavolo mancante' });
    }
    
    console.log(`📋 Operatore richiesto per tavolo: ${tavolo}`);
    
    // Leggi ordini e menu
    const ordini = leggiFileSicuro(FILE_PATH);
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    const ordiniTavolo = ordini.filter(o => o.tavolo.toString() === tavolo && o.stato !== 'chiuso');
    
    // Calcola totale
    const totale = ordiniTavolo.reduce((tot, ordine) => {
      return tot + ordine.ordinazione.reduce((sum, item) => sum + (item.prezzo * item.quantità), 0);
    }, 0);
    
    res.json({
      success: true,
      tavolo: tavolo,
      ordini: ordiniTavolo,
      menu: menu,
      coperto: coperto,
      totale: totale,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore endpoint operatore:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});



// ✅ ENDPOINT ORDINA (PAGINA CLIENTI) - AGGIUNGI QUESTO
app.get('/ordina', (req, res) => {
  try {
    const { tavolo } = req.query;
    
    if (!tavolo) {
      return res.status(400).send('Numero tavolo mancante');
    }
    
    console.log(`📱 Pagina ordine richiesta per tavolo: ${tavolo}`);
    
    // Leggi il menu
    const menu = leggiFileSicuro(MENU_FILE_PATH);
    
    // Crea una pagina HTML semplice per gli ordini
    const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ordina - Tavolo ${tavolo} - Ristorante Bellavista</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
            .header { text-align: center; margin-bottom: 30px; }
            .tavolo-info { background: #2c3e50; color: white; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
            .categoria { margin-bottom: 30px; }
            .categoria h3 { color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 5px; }
            .prodotto { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
            .prodotto:hover { background: #f9f9f9; }
            .nome { font-weight: bold; }
            .prezzo { color: #27ae60; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Ristorante Bellavista</h1>
                <div class="tavolo-info">
                    <h2>Tavolo ${tavolo}</h2>
                </div>
            </div>
            
            <div id="menu">
                ${menu.reduce((html, prodotto) => {
                  if (!html.includes(`<h3>${prodotto.categoria}</h3>`)) {
                    html += `<div class="categoria"><h3>${prodotto.categoria}</h3>`;
                  }
                  html += `
                    <div class="prodotto">
                      <span class="nome">${prodotto.nome}</span>
                      <span class="prezzo">€ ${prodotto.prezzo}</span>
                    </div>
                  `;
                  return html;
                }, '')}
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666;">
                <p>Per ordinare, chiama il cameriere o usa l'app del personale</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('❌ Errore endpoint ordina:', error);
    res.status(500).send('Errore interno del server');
  }
});






// ✅ ENDPOINT GESTIONE MENU HTML - AGGIUNGI QUESTO
app.get('/gestione-menu', (req, res) => {
  try {
    console.log('📋 Pagina gestione menu richiesta');
    
    const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestione Menu - Ristorante Bellavista</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: #f0f2f5; 
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
            }
            .header { 
                background: #2c3e50; 
                color: white; 
                padding: 20px; 
                border-radius: 10px; 
                margin-bottom: 20px; 
                text-align: center;
            }
            .section { 
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                margin-bottom: 20px; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
            }
            .form-group { 
                margin-bottom: 15px; 
            }
            .form-group label { 
                display: block; 
                margin-bottom: 5px; 
                font-weight: bold; 
            }
            .form-group input, .form-group select { 
                width: 100%; 
                padding: 8px; 
                border: 1px solid #ddd; 
                border-radius: 4px; 
                box-sizing: border-box;
            }
            .btn { 
                padding: 10px 20px; 
                background: #27ae60; 
                color: white; 
                border: none; 
                border-radius: 5px; 
                cursor: pointer; 
                margin-right: 10px;
            }
            .btn-danger { 
                background: #e74c3c; 
            }
            .menu-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
                gap: 15px; 
                margin-top: 20px;
            }
            .prodotto-card { 
                border: 1px solid #ddd; 
                padding: 15px; 
                border-radius: 8px; 
                position: relative;
            }
            .prodotto-nome { 
                font-weight: bold; 
                font-size: 1.1em; 
                margin-bottom: 5px; 
            }
            .prodotto-prezzo { 
                color: #27ae60; 
                font-size: 1.2em; 
                margin-bottom: 5px; 
            }
            .prodotto-categoria { 
                color: #666; 
                font-style: italic; 
            }
            .azioni { 
                position: absolute; 
                top: 10px; 
                right: 10px; 
            }
            .categoria-section { 
                margin-bottom: 30px; 
            }
            .categoria-title { 
                color: #2c3e50; 
                border-bottom: 2px solid #2c3e50; 
                padding-bottom: 5px; 
                margin-bottom: 15px; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Gestione Menu - Ristorante Bellavista</h1>
                <p>Aggiungi, modifica o elimina prodotti dal menu</p>
            </div>
            
            <!-- FORM AGGIUNTA PRODOTTO -->
            <div class="section">
                <h2>Aggiungi Nuovo Prodotto</h2>
                <form id="form-prodotto">
                    <div class="form-group">
                        <label for="nome">Nome Prodotto:</label>
                        <input type="text" id="nome" required>
                    </div>
                    <div class="form-group">
                        <label for="prezzo">Prezzo (€):</label>
                        <input type="number" id="prezzo" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="categoria">Categoria:</label>
                        <select id="categoria" required>
                            <option value="">Seleziona categoria</option>
                            <option value="Antipasti">Antipasti</option>
                            <option value="Primi">Primi</option>
                            <option value="Secondi">Secondi</option>
                            <option value="Contorni">Contorni</option>
                            <option value="Dolci">Dolci</option>
                            <option value="Bevande">Bevande</option>
                            <option value="Birre">Birre</option>
                            <option value="Vini">Vini</option>
                            <option value="Frutta">Frutta</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="descrizione">Descrizione (opzionale):</label>
                        <input type="text" id="descrizione">
                    </div>
                    <button type="submit" class="btn">Aggiungi Prodotto</button>
                </form>
            </div>
            
            <!-- LISTA PRODOTTI -->
            <div class="section">
                <h2>Menu Attuale</h2>
                <div id="menu-container">
                    <!-- I prodotti verranno caricati qui -->
                </div>
            </div>
        </div>

        <script>
            let menu = [];
            
            // Carica il menu dal backend
            async function caricaMenu() {
                try {
                    const response = await fetch('/api/menu');
                    menu = await response.json();
                    mostraMenu();
                } catch (error) {
                    console.error('Errore caricamento menu:', error);
                    alert('Errore nel caricamento del menu');
                }
            }
            
            // Mostra il menu organizzato per categorie
            function mostraMenu() {
                const container = document.getElementById('menu-container');
                const categorie = [...new Set(menu.map(p => p.categoria))];
                
                container.innerHTML = categorie.map(categoria => {
                    const prodottiCategoria = menu.filter(p => p.categoria === categoria);
                    return \`
                        <div class="categoria-section">
                            <h3 class="categoria-title">\${categoria}</h3>
                            <div class="menu-grid">
                                \${prodottiCategoria.map(prodotto => \`
                                    <div class="prodotto-card">
                                        <div class="azioni">
                                            <button class="btn btn-danger" onclick="eliminaProdotto(\${prodotto.id})">Elimina</button>
                                        </div>
                                        <div class="prodotto-nome">\${prodotto.nome}</div>
                                        <div class="prodotto-prezzo">€ \${prodotto.prezzo}</div>
                                        <div class="prodotto-categoria">\${prodotto.categoria}</div>
                                        \${prodotto.descrizione ? '<div class="prodotto-descrizione">' + prodotto.descrizione + '</div>' : ''}
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                }).join('');
            }
            
            // Aggiungi nuovo prodotto
            document.getElementById('form-prodotto').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nome = document.getElementById('nome').value;
                const prezzo = parseFloat(document.getElementById('prezzo').value);
                const categoria = document.getElementById('categoria').value;
                const descrizione = document.getElementById('descrizione').value;
                
                try {
                    const response = await fetch('/api/menu', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            nome: nome,
                            prezzo: prezzo,
                            categoria: categoria,
                            descrizione: descrizione
                        })
                    });
                    
                    if (response.ok) {
                        alert('Prodotto aggiunto con successo!');
                        document.getElementById('form-prodotto').reset();
                        caricaMenu(); // Ricarica il menu
                    } else {
                        alert('Errore nell\'aggiunta del prodotto');
                    }
                } catch (error) {
                    console.error('Errore:', error);
                    alert('Errore di connessione');
                }
            });
            
            // Elimina prodotto
            async function eliminaProdotto(id) {
                if (confirm('Sei sicuro di voler eliminare questo prodotto?')) {
                    try {
                        const response = await fetch(\`/api/menu/\${id}\`, {
                            method: 'DELETE'
                        });
                        
                        if (response.ok) {
                            alert('Prodotto eliminato con successo!');
                            caricaMenu(); // Ricarica il menu
                        } else {
                            alert('Errore nell\'eliminazione del prodotto');
                        }
                    } catch (error) {
                        console.error('Errore:', error);
                        alert('Errore di connessione');
                    }
                }
            }
            
            // Carica il menu all'avvio
            caricaMenu();
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('❌ Errore pagina gestione menu:', error);
    res.status(500).send('Errore interno del server');
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
















