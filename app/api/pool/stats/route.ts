//app/api/pool/stats/route.ts

import { NextResponse } from 'next/server';
import { getPoolStats } from '@/lib/dataImpulseApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poolType = searchParams.get('poolType');

  if (!poolType) {
    return NextResponse.json({ error: 'Pool type is required' }, { status: 400 });
  }

  try {
    const stats = await getPoolStats(poolType);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch pool stats:', error);
    return NextResponse.json({ error: 'Failed to fetch pool stats' }, { status: 500 });
  }
}
