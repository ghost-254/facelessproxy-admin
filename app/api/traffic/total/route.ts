import { NextResponse } from 'next/server';
import { getSubUserList, getSubUserUsageStats } from '@/lib/dataImpulseApi';
import { ensureAdminApiAccess } from '@/lib/auth/server';

export async function GET() {
  const authResult = await ensureAdminApiAccess();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    // Fetch sub-users
    const subUsers = await getSubUserList();

    // Validate and fallback if subUsers.items is not an array
    const subUserItems = subUsers?.items || [];
    if (!Array.isArray(subUserItems)) {
      throw new Error('Invalid sub-user data structure');
    }

    let totalTraffic = 0;

    // Iterate through each sub-user to calculate total traffic usage
    for (const subUser of subUserItems) {
      const usageStats = await getSubUserUsageStats(subUser.id, 'month');
      const userTraffic = usageStats?.usage?.reduce(
        (sum: number, usage: { traffic: number }) => sum + usage.traffic,
        0
      ) || 0;
      totalTraffic += userTraffic;
    }

    return NextResponse.json({ total: totalTraffic });
  } catch (error) {
    console.error('Failed to fetch total traffic:', error);
    return NextResponse.json({ error: 'Failed to fetch total traffic' }, { status: 500 });
  }
}
