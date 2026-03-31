/**
 * Google Contacts (People API) types — placeholder for post-Milestone 1
 */

export interface GoogleContact {
  resourceName: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  anniversary: string | null;
  photoUrl: string | null;
  organization: string | null;
  notes: string | null;
}

export interface ContactRow {
  id: string;
  user_id: string;
  google_resource_name: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  anniversary: string | null;
  photo_url: string | null;
  organization: string | null;
  notes: string | null;
  leo_tags: string[] | null;
  last_synced: string | null;
}
