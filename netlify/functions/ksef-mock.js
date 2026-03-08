// Mock KSeF API responses — used when test/demo environment is offline
// All responses include [MOCK] marker so the user knows it's simulated data

function generateMockToken() {
  return 'MOCK-' + Array(60).fill(0).map(() =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('').toUpperCase();
}

function generateMockReference(nip) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 14).toUpperCase();
  return `${date}-SE-${nip || '0000000000'}-${random}`;
}

function generateMockElementReference(nip) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 14).toUpperCase();
  return `${date}-SE-${nip || '0000000000'}-F${random}`;
}

const mockApi = {
  /**
   * Mock: InitToken → returns session with MOCK token
   */
  initSession(nip) {
    const token = generateMockToken();
    const referenceNumber = generateMockReference(nip);
    return {
      statusCode: 201,
      body: {
        sessionToken: token,
        referenceNumber,
        isMock: true,
        mockMessage: '[MOCK] Sesja symulowana — środowisko KSeF niedostępne.',
        context: {
          contextIdentifier: { type: 'onip', identifier: nip },
          contextName: {
            tradeName: '[MOCK] Firma testowa',
            fullName: '[MOCK] Firma testowa Sp. z o.o.',
          },
        },
        timestamp: new Date().toISOString(),
      },
    };
  },

  /**
   * Mock: Close session
   */
  closeSession(referenceNumber) {
    return {
      statusCode: 200,
      body: {
        processingCode: 200,
        processingDescription: '[MOCK] Sesja zamknięta.',
        referenceNumber,
        isMock: true,
        timestamp: new Date().toISOString(),
      },
    };
  },

  /**
   * Mock: Send invoice → returns fake ksefRef
   */
  sendInvoice(invoiceNumber, nip) {
    const ksefRef = generateMockElementReference(nip);
    return {
      statusCode: 201,
      body: {
        ksefRef,
        elementReferenceNumber: ksefRef,
        processingCode: 200,
        processingDescription: '[MOCK] Faktura przyjęta (symulacja).',
        invoiceNumber,
        isMock: true,
        timestamp: new Date().toISOString(),
      },
    };
  },

  /**
   * Mock: Receive documents → returns sample invoices
   */
  receiveDocuments(nip) {
    const docs = [
      {
        ksefRef: generateMockElementReference(nip),
        invoiceNumber: '[MOCK] FV/2026/M001',
        issuerNip: '5260001521',
        issueDate: new Date().toISOString().slice(0, 10),
        receivedAt: new Date().toISOString(),
        grossAmount: 12300.00,
      },
      {
        ksefRef: generateMockElementReference(nip),
        invoiceNumber: '[MOCK] FV/2026/M002',
        issuerNip: '7820012345',
        issueDate: new Date().toISOString().slice(0, 10),
        receivedAt: new Date().toISOString(),
        grossAmount: 5670.00,
      },
    ];
    return {
      statusCode: 200,
      body: {
        documents: docs,
        isMock: true,
        mockMessage: '[MOCK] Dokumenty symulowane — środowisko KSeF niedostępne.',
      },
    };
  },

  /**
   * Mock: Fetch UPO
   */
  fetchUpo(ksefRef, invoiceNumber) {
    return {
      statusCode: 200,
      body: {
        ksefReferenceNumber: ksefRef,
        invoiceReferenceNumber: invoiceNumber || 'FV/MOCK',
        acquisitionTimestamp: new Date().toISOString(),
        hashSHA: 'MOCK' + Buffer.from(ksefRef).toString('base64').slice(0, 40),
        isMock: true,
        mockMessage: '[MOCK] UPO symulowane — prawdziwe UPO dostępne w godzinach pracy KSeF.',
        fileSignatureList: [{
          hashSHA: {
            algorithm: 'SHA-256',
            encoding: 'Base64',
            value: 'MOCK' + Buffer.from(ksefRef).toString('base64').slice(0, 40),
          }
        }],
      },
    };
  },
};

module.exports = { mockApi, generateMockToken, generateMockReference, generateMockElementReference };
