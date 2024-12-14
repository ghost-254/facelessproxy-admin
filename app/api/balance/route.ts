//app/api/balance/route.ts

import { NextResponse } from 'next/server';
import { getBalance } from '@/lib/dataImpulseApi';

export async function GET() {
  try {
    const balance = await getBalance();
    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Failed to fetch balance:', error);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
