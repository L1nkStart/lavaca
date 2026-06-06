import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import CampaignsClient from './campaigns-client';
import { Loader2 } from 'lucide-react';

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    location?: string;
    status?: string;
    verified?: string;
    sort?: string;
  };
}

const ITEMS_PER_PAGE = 12;

async function getCampaigns(searchParams: PageProps['searchParams']) {
  const supabase = await createClient();

  const page = parseInt(searchParams.page || '1');
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  // Build query
  let query = supabase
    .from('campaigns')
    .select(`
      *,
      categories (
        name,
        icon_emoji
      ),
      users!campaigns_creator_id_fkey (
        full_name,
        kyc_status
      )
    `, { count: 'exact' })
    .eq('status', 'active');

  // Apply filters
  if (searchParams.search) {
    query = query.or(`title.ilike.%${searchParams.search}%,story.ilike.%${searchParams.search}%`);
  }

  if (searchParams.category) {
    query = query.eq('category_id', searchParams.category);
  }

  if (searchParams.location) {
    query = query.ilike('location', `%${searchParams.location}%`);
  }

  if (searchParams.verified === 'true') {
    // Filter by verified creators - will need to join
    const { data: verifiedUsers } = await supabase
      .from('users')
      .select('id')
      .eq('kyc_status', 'verified');

    if (verifiedUsers) {
      query = query.in('creator_id', verifiedUsers.map(u => u.id));
    }
  }

  // Apply sorting
  const sortBy = searchParams.sort || 'recent';
  switch (sortBy) {
    case 'recent':
      query = query.order('created_at', { ascending: false });
      break;
    case 'popular':
      query = query.order('current_amount_usd', { ascending: false });
      break;
    case 'goal':
      query = query.order('goal_amount_usd', { ascending: false });
      break;
    case 'ending':
      query = query.order('end_date', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  // Apply pagination
  query = query.range(from, to);

  const { data: campaigns, error, count } = await query;

  if (error) {
    console.error('Error fetching campaigns:', error);
    return { campaigns: [], total: 0, error: error.message };
  }

  // Get donation counts efficiently with a single query
  const campaignIds = campaigns?.map(c => c.id) || [];
  const { data: donationCounts } = await supabase
    .from('donations')
    .select('campaign_id')
    .in('campaign_id', campaignIds)
    .eq('payment_status', 'completed');

  // Count donations per campaign
  const donationCountMap = donationCounts?.reduce((acc: Record<string, number>, donation) => {
    acc[donation.campaign_id] = (acc[donation.campaign_id] || 0) + 1;
    return acc;
  }, {}) || {};

  // Add donation counts to campaigns
  const campaignsWithCounts = campaigns?.map(campaign => ({
    ...campaign,
    donation_count: donationCountMap[campaign.id] || 0,
  })) || [];

  return {
    campaigns: campaignsWithCounts,
    total: count || 0,
    error: null,
  };
}

async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('categories')
    .select('id, name, icon_emoji')
    .order('name');

  return data || [];
}

export default async function CampaignsPage({ searchParams }: PageProps) {
  // Await searchParams to fix Next.js 15 requirement
  const params = await searchParams;

  const [{ campaigns, total, error }, categories] = await Promise.all([
    getCampaigns(params),
    getCategories(),
  ]);

  const currentPage = parseInt(params.page || '1');
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <CampaignsClient
        campaigns={campaigns}
        categories={categories}
        total={total}
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={params}
        error={error}
      />
    </Suspense>
  );
}
