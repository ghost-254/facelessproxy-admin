import { NextResponse } from 'next/server';
import { setDefaultPoolParameters } from '@/lib/dataImpulseApi';
import { ensureAdminApiAccess } from '@/lib/auth/server';

export async function POST(request: Request) {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { subuser_id, country, city, zipCode, asn, anonymousFilter, rotationInterval } = await request.json();

    const countryCode = country;

    const params = {
      countries: [countryCode],
      exclude_asn: asn ? [parseInt(asn)] : [],
      anonymous_filter: anonymousFilter || false,
      rotation_interval: rotationInterval || null,
    };

    // Optionally log or map city/zip data to country-specific logic
    if (city || zipCode) {
      console.log(`Custom filtering logic for ${city}, ${zipCode}`);
    }

    await setDefaultPoolParameters(subuser_id, params);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting target filters:', error);
    return NextResponse.json({ error: 'Failed to set target filters' }, { status: 500 });
  }
}
