//app/api/sub-users/route.ts

'use server';

import { NextResponse } from 'next/server';
import { getSubUserList } from '@/lib/dataImpulseApi';
import { ensureAdminApiAccess } from '@/lib/auth/server';

interface SubUser {
  id: string;
  label: string;
  login: string;
  password: string;
  remainingTraffic: number;
  balance_format: string;
  threads: number;
  pool_type: string;
}

export async function GET() {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    let subUsers: SubUser[] = []; // Explicitly type the variable
    let offset = 0;
    const limit = 100;

    // Fetch all pages of sub-users
    while (true) {
      const response = await getSubUserList(limit, offset);
      if (response.items?.length) {
        subUsers = [...subUsers, ...response.items];
        offset += limit;
      } else {
        break; // Break the loop when no more items are returned
      }
    }

    return NextResponse.json({ items: subUsers });
  } catch (error) {
    console.error('Failed to fetch sub-user list:', error);
    return NextResponse.json({ error: 'Failed to fetch sub-user list' }, { status: 500 });
  }
}
