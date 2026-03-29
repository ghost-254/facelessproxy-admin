//app/api/traffic/route.ts

import { NextResponse } from 'next/server';
import { addSubUserBalance } from '@/lib/dataImpulseApi';
import { ensureAdminApiAccess } from '@/lib/auth/server';

export async function POST(request: Request) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { subUserId, traffic } = await request.json();
    await addSubUserBalance(subUserId, traffic);
    return NextResponse.json({ message: 'Traffic updated successfully' });
  } catch (error) {
    console.error('Failed to update traffic:', error);
    return NextResponse.json({ error: 'Failed to update traffic' }, { status: 500 });
  }
}
