import { NextResponse } from 'next/server';
import { createSubUser } from '@/lib/dataImpulseApi';

export async function POST(request: Request) {
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
