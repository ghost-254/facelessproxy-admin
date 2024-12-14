//app/api/sub-users/[id]/route.ts

'use server';

import { NextResponse } from 'next/server';
import { deleteSubUser } from '@/lib/dataImpulseApi';

// Delete a sub-user
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    // Ensure `params.id` is awaited (handled correctly by Next.js)
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Sub-user ID is required' }, { status: 400 });
    }

    // Call your helper function to delete the sub-user
    await deleteSubUser(id);
    return NextResponse.json({ message: `Sub-user ${id} deleted successfully` });
  } catch (error) {
    console.error('Failed to delete sub-user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
