import { NextResponse } from 'next/server';
import { getSubUserList } from '@/lib/dataImpulseApi';

export async function GET() {
  try {
    let total = 0; // Initialize the total counter
    let offset = 0; // Start offset for pagination
    const limit = 100; // Number of users per API call

    while (true) {
      // Fetch sub-users with pagination
      const response = await getSubUserList(limit, offset);

      if (!response.items || response.items.length === 0) break; // Exit if no more sub-users are found

      total += response.items.length; // Add the count of this batch
      offset += limit; // Increment the offset for the next batch
    }

    return NextResponse.json({ count: total });
  } catch (error) {
    console.error('Failed to fetch sub-user count:', error);
    return NextResponse.json({ error: 'Failed to fetch sub-user count' }, { status: 500 });
  }
}
