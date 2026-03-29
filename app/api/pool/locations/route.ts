//app/api/pool/locations/route.ts

import { NextResponse } from 'next/server';
import { getLocations } from '@/lib/dataImpulseApi';
import { ensureAdminApiAccess } from '@/lib/auth/server';

export async function GET(request: Request) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url); // Parse query parameters
    const poolType = searchParams.get('pool_type'); // Get the pool_type parameter

    if (!poolType) {
      return NextResponse.json({ error: 'Pool type is required' }, { status: 400 });
    }

    const locations = await getLocations(poolType); // Call the utility function
    return NextResponse.json(locations); // Respond with the locations
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
