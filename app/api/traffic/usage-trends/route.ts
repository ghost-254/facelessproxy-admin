import { NextResponse } from 'next/server';
import { getSubUserList, getSubUserUsageStats } from '@/lib/dataImpulseApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';

  try {
    // Fetch sub-users
    const subUsers = await getSubUserList();

    // Ensure subUsers.items is iterable and handle potential null/undefined
    const subUserItems = subUsers?.items || [];
    if (!Array.isArray(subUserItems)) {
      throw new Error('Invalid sub-user data format');
    }

    const usageTrends = [];

    // Iterate through each sub-user to fetch their usage stats
    for (const subUser of subUserItems) {
      const usageStats = await getSubUserUsageStats(subUser.id, period);
      usageTrends.push({
        subUserId: subUser.id,
        usage: usageStats.usage,
      });
    }

    return NextResponse.json(usageTrends);
  } catch (error) {
    console.error('Failed to fetch traffic usage trends:', error);
    return NextResponse.json({ error: 'Failed to fetch traffic usage trends' }, { status: 500 });
  }
}
