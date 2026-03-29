import { NextResponse } from 'next/server';
import { createSubUser } from '@/lib/dataImpulseApi';
import { ensureAdminApiAccess } from '@/lib/auth/server';

export async function POST(request: Request) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const { name, proxyPool } = body;

    const newUser = await createSubUser({
      label: name,
      pool_type: proxyPool,
      threads: 100, // Default threads
    });

    return NextResponse.json(newUser);
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
