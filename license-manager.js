// backend/license-manager.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { LICENSES, generateTrialLicense } = require('./licenses');

class LicenseManager {
  constructor() {
    this.licenseFile = path.join(__dirname, 'license.json');
    this.secretKey = 'ristorante-bellavista-2024';
    
    console.log('🔐 Inizializzazione LicenseManager...');
    this.initializeLicenseSystem();
  }

  initializeLicenseSystem() {
    console.log('📄 Controllo stato licenza...');
    
    if (!fs.existsSync(this.licenseFile)) {
      console.log('🆕 Nessuna licenza trovata - Creazione automatica trial...');
      return this.createAndVerifyTrialLicense();
    }
    
    try {
      const licenseData = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
      console.log('📋 Licenza esistente trovata:', licenseData.licenseId);
      
      const verification = this.verifyLicense();
      if (!verification.valid) {
        console.log('❌ Licenza non valida:', verification.reason);
        console.log('🔄 Rigenerazione licenza trial...');
        return this.createAndVerifyTrialLicense();
      }
      
      console.log('✅ Licenza valida - Sistema pronto');
      return verification;
    } catch (error) {
      console.error('❌ Errore inizializzazione:', error);
      return this.createAndVerifyTrialLicense();
    }
  }

  // ✅ CREA E VERIFICA IMMEDIATAMENTE LA LICENZA TRIAL
  createAndVerifyTrialLicense(customerInfo = {}) {
    try {
      console.log('🎯 Creazione licenza trial...');
      
      // Crea la licenza trial di base
      const trialLicense = generateTrialLicense();
      
      // Aggiorna con info cliente se fornite
      trialLicense.customer = {
        name: customerInfo.name || 'Trial User',
        email: customerInfo.email || 'trial@ristorante.com',
        company: customerInfo.company || 'N/D',
        phone: customerInfo.phone || ''
      };

      trialLicense.activated = new Date().toISOString();
      trialLicense.trial = true;
      trialLicense.machineId = os.hostname();
      
      // ✅ GENERA LA FIRMA PRIMA DI TUTTO
      trialLicense.signature = this.generateSignature(trialLicense);
      
      console.log('📝 Licenza generata:', {
        id: trialLicense.licenseId,
        type: trialLicense.type,
        expiry: trialLicense.expiryDate,
        hasSignature: !!trialLicense.signature
      });
      
      // Salva la licenza
      this.saveLicense(trialLicense);
      
      // ✅ VERIFICA IMMEDIATA
      console.log('🔍 Verifica licenza appena creata...');
      const verification = this.verifyLicense();
      
      if (verification.valid) {
        console.log('✅ Licenza trial creata e verificata con successo!');
        console.log('📅 Scadenza:', verification.expiryDate);
        console.log('📊 Giorni rimanenti:', verification.daysRemaining);
      } else {
        console.log('❌ Licenza non valida dopo la creazione:', verification.reason);
        this.debugLicenseIssue();
      }
      
      return verification;
    } catch (error) {
      console.error('❌ Errore critico creazione licenza:', error);
      throw error;
    }
  }

  // ✅ GENERA LICENZA A PAGAMENTO (SEMESTRALE O ANNUALE)
  generatePaidLicense(licenseType, customerInfo) {
    const licenseConfig = LICENSES[licenseType];
    if (!licenseConfig) {
      throw new Error(`Tipo licenza non valido: ${licenseType}`);
    }

    const issueDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(issueDate.getDate() + licenseConfig.duration);

    const licenseData = {
      type: licenseType,
      issueDate: issueDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      licenseId: this.generateLicenseId(licenseType),
      customer: {
        name: customerInfo.name,
        email: customerInfo.email,
        company: customerInfo.company || '',
        phone: customerInfo.phone || ''
      },
      activated: new Date().toISOString(),
      machineId: os.hostname(),
      paid: true,
      features: licenseConfig.features,
      price: licenseConfig.price
    };

    // Aggiungi firma digitale
    licenseData.signature = this.generateSignature(licenseData);
    
    console.log('💰 Licenza a pagamento generata:', {
      type: licenseType,
      id: licenseData.licenseId,
      scadenza: licenseData.expiryDate,
      prezzo: licenseData.price
    });
    
    return licenseData;
  }

  // ✅ GENERA ID LICENZA UNIVOCO
  generateLicenseId(licenseType) {
    const prefixes = {
      'TRIAL': 'TRIAL',
      'SEMESTRAL': 'SEMS', 
      'ANNUAL': 'ANNU'
    };
    const prefix = prefixes[licenseType] || 'LIC';
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}_${random}_${timestamp}`;
  }

  // ✅ ATTIVA LICENZA A PAGAMENTO
  activatePaidLicense(licenseType, customerInfo) {
    try {
      console.log('🎯 Attivazione licenza a pagamento:', licenseType);
      
      const licenseData = this.generatePaidLicense(licenseType, customerInfo);
      this.saveLicense(licenseData);
      
      // Verifica immediata
      const verification = this.verifyLicense();
      
      if (verification.valid) {
        console.log('✅ Licenza a pagamento attivata con successo!');
        return {
          success: true,
          license: licenseData,
          verification: verification
        };
      } else {
        throw new Error(`Licenza non valida dopo l'attivazione: ${verification.reason}`);
      }
      
    } catch (error) {
      console.error('❌ Errore attivazione licenza a pagamento:', error);
      throw error;
    }
  }

  // ✅ VERIFICA LICENZA - VERSIONE MIGLIORATA
  verifyLicense() {
    try {
      if (!fs.existsSync(this.licenseFile)) {
        return { 
          valid: false, 
          reason: 'Licenza non trovata',
          needsActivation: true
        };
      }

      const licenseData = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
      
      // ✅ VERIFICA CAMPI OBBLIGATORI CON MESSAGGI DETTAGLIATI
      if (!licenseData.type) {
        return { valid: false, reason: 'Tipo licenza mancante' };
      }
      if (!licenseData.expiryDate) {
        return { valid: false, reason: 'Data scadenza mancante' };
      }
      if (!licenseData.licenseId) {
        return { valid: false, reason: 'ID licenza mancante' };
      }
      if (!licenseData.machineId) {
        return { valid: false, reason: 'Machine ID mancante' };
      }
      if (!licenseData.signature) {
        return { valid: false, reason: 'Firma digitale mancante' };
      }

      // ✅ VERIFICA INTEGRITÀ
      if (!this.verifyLicenseIntegrity(licenseData)) {
        return { 
          valid: false, 
          reason: 'Licenza corrotta o modificata',
          tampered: true
        };
      }

      // ✅ VERIFICA SCADENZA
      const now = new Date();
      const expiryDate = new Date(licenseData.expiryDate);
      
      if (isNaN(expiryDate.getTime())) {
        return { valid: false, reason: 'Data scadenza non valida' };
      }
      
      if (expiryDate < now) {
        return { 
          valid: false, 
          reason: 'Licenza scaduta',
          expired: true,
          expiryDate: licenseData.expiryDate
        };
      }

      const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      
      return { 
        valid: true, 
        license: licenseData,
        daysRemaining: daysRemaining,
        type: licenseData.type,
        expiryDate: licenseData.expiryDate,
        trial: licenseData.trial || false,
        paid: licenseData.paid || false
      };

    } catch (error) {
      console.error('❌ Errore verifica licenza:', error);
      return { 
        valid: false, 
        reason: 'Errore di sistema nella verifica'
      };
    }
  }

  // ✅ GENERA FIRMA DIGITALE - VERSIONE ROBUSTA
  generateSignature(licenseData) {
    try {
      // Usa solo i campi essenziali per la firma
      const dataToSign = {
        type: licenseData.type,
        licenseId: licenseData.licenseId,
        expiryDate: licenseData.expiryDate,
        machineId: licenseData.machineId || os.hostname()
      };
      
      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(dataToSign))
        .digest('hex');
      
      return signature;
    } catch (error) {
      console.error('❌ Errore generazione firma:', error);
      throw error;
    }
  }

  // ✅ VERIFICA INTEGRITÀ - VERSIONE MIGLIORATA
  verifyLicenseIntegrity(licenseData) {
    try {
      if (!licenseData.signature) {
        console.log('❌ Firma mancante');
        return false;
      }
      
      const dataToVerify = {
        type: licenseData.type,
        licenseId: licenseData.licenseId,
        expiryDate: licenseData.expiryDate,
        machineId: licenseData.machineId
      };
      
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(dataToVerify))
        .digest('hex');
      
      const isValid = licenseData.signature === expectedSignature;
      
      if (!isValid) {
        console.log('❌ Firma non valida');
        console.log('   Attesa:', expectedSignature.substring(0, 16) + '...');
        console.log('   Ricevuta:', licenseData.signature.substring(0, 16) + '...');
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Errore verifica integrità:', error);
      return false;
    }
  }

  // ✅ SALVA LICENZA - VERSIONE SICURA
  saveLicense(licenseData) {
    try {
      // Assicurati che tutti i campi necessari esistano
      const completeLicense = {
        type: licenseData.type || 'TRIAL',
        issueDate: licenseData.issueDate || new Date().toISOString(),
        expiryDate: licenseData.expiryDate,
        licenseId: licenseData.licenseId,
        customer: licenseData.customer || {
          name: 'Trial User',
          email: 'trial@ristorante.com'
        },
        activated: licenseData.activated || new Date().toISOString(),
        machineId: licenseData.machineId || os.hostname(),
        trial: licenseData.trial !== undefined ? licenseData.trial : true,
        paid: licenseData.paid || false,
        features: licenseData.features || [],
        price: licenseData.price || 0,
        signature: licenseData.signature
      };
      
      if (!completeLicense.signature) {
        completeLicense.signature = this.generateSignature(completeLicense);
      }
      
      fs.writeFileSync(this.licenseFile, JSON.stringify(completeLicense, null, 2));
      console.log('💾 Licenza salvata:', completeLicense.licenseId);
      
      return completeLicense;
    } catch (error) {
      console.error('❌ Errore salvataggio licenza:', error);
      throw error;
    }
  }

  // ✅ GET STATO LICENZA (per API)
  getLicenseStatus() {
    return this.verifyLicense();
  }

  // ✅ GET INFO LICENZA (senza verifiche)
  getLicenseInfo() {
    try {
      if (!fs.existsSync(this.licenseFile)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
    } catch (error) {
      console.error('❌ Errore lettura info licenza:', error);
      return null;
    }
  }

  // ✅ RESET LICENZA
  resetLicense() {
    try {
      console.log('🔄 Reset licenza...');
      
      if (fs.existsSync(this.licenseFile)) {
        const backupPath = this.licenseFile + '.backup';
        fs.copyFileSync(this.licenseFile, backupPath);
        fs.unlinkSync(this.licenseFile);
        console.log('📦 Backup creato:', backupPath);
      }
      
      return this.createAndVerifyTrialLicense();
    } catch (error) {
      console.error('❌ Errore reset licenza:', error);
      throw error;
    }
  }

  // ✅ DEBUG PROBLEMI LICENZA
  debugLicenseIssue() {
    try {
      if (!fs.existsSync(this.licenseFile)) {
        console.log('📄 File licenza non esiste');
        return;
      }
      
      const licenseData = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
      const expectedSignature = this.generateSignature(licenseData);
      
      console.log('🔧 DEBUG DETTAGLIATO:');
      console.log('   - License Data:', {
        type: licenseData.type,
        licenseId: licenseData.licenseId,
        expiryDate: licenseData.expiryDate,
        machineId: licenseData.machineId
      });
      console.log('   - Signature presente:', !!licenseData.signature);
      console.log('   - Signature attesa:', expectedSignature);
      console.log('   - Signature attuale:', licenseData.signature);
      console.log('   - Match:', licenseData.signature === expectedSignature);
      
    } catch (error) {
      console.error('❌ Errore debug:', error);
    }
  }

  // ✅ OTTIENI TIPI LICENZA DISPONIBILI
  getAvailableLicenseTypes() {
    return LICENSES;
  }

  // ✅ VERIFICA SE LA LICENZA È TRIAL
  isTrial() {
    const licenseInfo = this.getLicenseInfo();
    return licenseInfo && licenseInfo.trial === true;
  }

  // ✅ VERIFICA SE LA LICENZA È A PAGAMENTO
  isPaid() {
    const licenseInfo = this.getLicenseInfo();
    return licenseInfo && licenseInfo.paid === true;
  }

  // ✅ OTTIENI GIORNI RIMANENTI
  getDaysRemaining() {
    const status = this.verifyLicense();
    return status.valid ? status.daysRemaining : 0;
  }
}

module.exports = LicenseManager;