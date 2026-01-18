#!/usr/bin/env ts-node
/**
 * Test WhatsApp API Connection Status
 * Simulates what the admin panel API route does
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

interface EvolutionStatusResponse {
  instance?: {
    state: string;
    profileName?: string;
    profilePictureUrl?: string;
  };
}

interface AvisaStatusResponse {
  status?: boolean;
  data?: {
    data?: {
      Connected?: boolean;
      LoggedIn?: boolean;
      Jid?: string;
    };
  };
}

async function checkEvolutionConnection() {
  console.log('\n📞 Checking Evolution API...');

  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
  const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap';

  if (!EVOLUTION_API_KEY) {
    console.log('❌ EVOLUTION_API_KEY not configured');
    return { connected: false, error: 'Missing API key' };
  }

  const url = `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`;
  console.log(`🔗 URL: ${url}`);
  console.log(`🔑 Instance: ${EVOLUTION_INSTANCE}`);

  try {
    const response = await axios.get<EvolutionStatusResponse>(url, {
      headers: { apikey: EVOLUTION_API_KEY },
      timeout: 10000,
    });

    const isConnected = response.data?.instance?.state === 'open';

    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response data:`, JSON.stringify(response.data, null, 2));
    console.log(`✅ Connected: ${isConnected}`);
    console.log(`📱 State: ${response.data?.instance?.state}`);
    console.log(`👤 Profile: ${response.data?.instance?.profileName || 'N/A'}`);

    return {
      connected: isConnected,
      state: response.data?.instance?.state,
      profileName: response.data?.instance?.profileName,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`❌ HTTP Error: ${error.response?.status} - ${error.response?.statusText}`);
      console.log(`📊 Error data:`, JSON.stringify(error.response?.data, null, 2));
    } else {
      console.log(`❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
    }
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

async function checkAvisaConnection() {
  console.log('\n💬 Checking Avisa API...');

  const AVISA_API_URL = process.env.AVISA_API_URL || 'https://www.avisaapi.com.br/api';
  const AVISA_API_TOKEN = process.env.AVISA_API_TOKEN;

  if (!AVISA_API_TOKEN) {
    console.log('❌ AVISA_API_TOKEN not configured');
    return { connected: false, error: 'Missing API token' };
  }

  const url = `${AVISA_API_URL}/instance/status`;
  console.log(`🔗 URL: ${url}`);

  try {
    const response = await axios.get<AvisaStatusResponse>(url, {
      headers: { Authorization: `Bearer ${AVISA_API_TOKEN}` },
      timeout: 10000,
    });

    const isConnected = response.data?.data?.data?.Connected === true;

    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response data:`, JSON.stringify(response.data, null, 2));
    console.log(`✅ Connected: ${isConnected}`);
    console.log(`🔐 Logged in: ${response.data?.data?.data?.LoggedIn || 'N/A'}`);
    console.log(`📱 JID: ${response.data?.data?.data?.Jid || 'N/A'}`);

    return {
      connected: isConnected,
      loggedIn: response.data?.data?.data?.LoggedIn,
      jid: response.data?.data?.data?.Jid,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`❌ HTTP Error: ${error.response?.status} - ${error.response?.statusText}`);
      console.log(`📊 Error data:`, JSON.stringify(error.response?.data, null, 2));
    } else {
      console.log(`❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
    }
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

async function main() {
  console.log('🔍 Testing WhatsApp API Connections');
  console.log('=' .repeat(60));

  const [evolution, avisa] = await Promise.all([
    checkEvolutionConnection(),
    checkAvisaConnection(),
  ]);

  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Evolution API: ${evolution.connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
  console.log(`Avisa API:     ${avisa.connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
  console.log('=' .repeat(60) + '\n');
}

main().catch(console.error);
