export interface Player {
  id: number;
  name: string;
  role: string;
  country: string;
  base_price: number;
  image_url: string;
  status: string;
}

export interface Team {
  id: number;
  name: string;
  total_budget: number;
  remaining_budget: number;
  max_players: number;
  logo_url: string;
}

export interface Bid {
  id: number;
  team_id: number;
  player_id: number;
  amount: number;
  timestamp: string;
}

export interface AuctionState {
  id: number;
  status: string;
  current_player: Player | null;
  current_bid: number;
  current_team_id: number | null;
  current_team_name: string | null;
  timer_seconds: number;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}