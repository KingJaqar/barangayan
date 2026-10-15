// Generated from a disposable local database through migration 0113 using Supabase CLI
// 2.118.0 `gen types typescript --db-url … --schema public`. Narrow extraction keeps
// the repository's existing generated/augmented database contracts intact.
import type { Json } from './database';

export type RoutingConditionsTables = {
  evacuation_center_entrance_nodes: {
    Row: { area_id: string; center_id: string; graph_version: string; mapped_at: string; mapped_by: string | null; node_id: string };
    Insert: { area_id: string; center_id: string; graph_version: string; mapped_at?: string; mapped_by?: string | null; node_id: string };
    Update: { area_id?: string; center_id?: string; graph_version?: string; mapped_at?: string; mapped_by?: string | null; node_id?: string };
    Relationships: [
      {
        foreignKeyName: 'evacuation_center_entrance_nodes_area_id_graph_version_fkey';
        columns: ['area_id', 'graph_version'];
        isOneToOne: false;
        referencedRelation: 'routing_graph_versions';
        referencedColumns: ['area_id', 'graph_version'];
      },
      {
        foreignKeyName: 'evacuation_center_entrance_nodes_center_id_fkey';
        columns: ['center_id'];
        isOneToOne: false;
        referencedRelation: 'evacuation_centers';
        referencedColumns: ['id'];
      },
    ];
  };
  road_closure_edges: {
    Row: { area_id: string; closure_id: string; edge_ids: string[]; graph_version: string; mapped_at: string; mapped_by: string | null };
    Insert: { area_id: string; closure_id: string; edge_ids: string[]; graph_version: string; mapped_at?: string; mapped_by?: string | null };
    Update: { area_id?: string; closure_id?: string; edge_ids?: string[]; graph_version?: string; mapped_at?: string; mapped_by?: string | null };
    Relationships: [
      {
        foreignKeyName: 'road_closure_edges_area_id_graph_version_fkey';
        columns: ['area_id', 'graph_version'];
        isOneToOne: false;
        referencedRelation: 'routing_graph_versions';
        referencedColumns: ['area_id', 'graph_version'];
      },
      {
        foreignKeyName: 'road_closure_edges_closure_id_fkey';
        columns: ['closure_id'];
        isOneToOne: false;
        referencedRelation: 'road_closures';
        referencedColumns: ['id'];
      },
    ];
  };
  road_closures: {
    Row: {
      area_id: string;
      geometry: Json;
      id: string;
      label: string;
      observed_at: string;
      published_at: string;
      published_by: string | null;
      published_revision: number;
      reason: string;
      reopen_reason: string | null;
      reopened_at: string | null;
      reopened_by: string | null;
      reopened_revision: number | null;
      source_refs: string[];
      status: string;
    };
    Insert: {
      area_id: string;
      geometry: Json;
      id?: string;
      label: string;
      observed_at: string;
      published_at?: string;
      published_by?: string | null;
      published_revision: number;
      reason: string;
      reopen_reason?: string | null;
      reopened_at?: string | null;
      reopened_by?: string | null;
      reopened_revision?: number | null;
      source_refs: string[];
      status?: string;
    };
    Update: {
      area_id?: string;
      geometry?: Json;
      id?: string;
      label?: string;
      observed_at?: string;
      published_at?: string;
      published_by?: string | null;
      published_revision?: number;
      reason?: string;
      reopen_reason?: string | null;
      reopened_at?: string | null;
      reopened_by?: string | null;
      reopened_revision?: number | null;
      source_refs?: string[];
      status?: string;
    };
    Relationships: [
      {
        foreignKeyName: 'road_closures_area_id_fkey';
        columns: ['area_id'];
        isOneToOne: false;
        referencedRelation: 'routing_areas';
        referencedColumns: ['id'];
      },
    ];
  };
  routing_areas: {
    Row: { active_graph_version: string | null; barangay_id: string; created_at: string; id: string; name: string; revised_at: string; revision: number };
    Insert: { active_graph_version?: string | null; barangay_id: string; created_at?: string; id: string; name: string; revised_at?: string; revision?: number };
    Update: { active_graph_version?: string | null; barangay_id?: string; created_at?: string; id?: string; name?: string; revised_at?: string; revision?: number };
    Relationships: [
      {
        foreignKeyName: 'routing_areas_active_graph_fkey';
        columns: ['id', 'active_graph_version'];
        isOneToOne: false;
        referencedRelation: 'routing_graph_versions';
        referencedColumns: ['area_id', 'graph_version'];
      },
      {
        foreignKeyName: 'routing_areas_barangay_id_fkey';
        columns: ['barangay_id'];
        isOneToOne: true;
        referencedRelation: 'barangays';
        referencedColumns: ['id'];
      },
    ];
  };
  routing_condition_events: {
    Row: { action: string; actor_id: string | null; area_id: string; created_at: string; details: Json; entity_id: string; entity_type: string; id: number; revision: number };
    Insert: { action: string; actor_id?: string | null; area_id: string; created_at?: string; details?: Json; entity_id: string; entity_type: string; id?: never; revision: number };
    Update: { action?: string; actor_id?: string | null; area_id?: string; created_at?: string; details?: Json; entity_id?: string; entity_type?: string; id?: never; revision?: number };
    Relationships: [
      {
        foreignKeyName: 'routing_condition_events_area_id_fkey';
        columns: ['area_id'];
        isOneToOne: false;
        referencedRelation: 'routing_areas';
        referencedColumns: ['id'];
      },
    ];
  };
  routing_graph_versions: {
    Row: { area_id: string; graph_version: string; registered_at: string; registered_by: string | null };
    Insert: { area_id: string; graph_version: string; registered_at?: string; registered_by?: string | null };
    Update: { area_id?: string; graph_version?: string; registered_at?: string; registered_by?: string | null };
    Relationships: [
      {
        foreignKeyName: 'routing_graph_versions_area_id_fkey';
        columns: ['area_id'];
        isOneToOne: false;
        referencedRelation: 'routing_areas';
        referencedColumns: ['id'];
      },
    ];
  };
  routing_tombstones: {
    Row: { area_id: string; entity_id: string; entity_type: string; removed_at: string; revision: number };
    Insert: { area_id: string; entity_id: string; entity_type: string; removed_at?: string; revision: number };
    Update: { area_id?: string; entity_id?: string; entity_type?: string; removed_at?: string; revision?: number };
    Relationships: [
      {
        foreignKeyName: 'routing_tombstones_area_id_fkey';
        columns: ['area_id'];
        isOneToOne: false;
        referencedRelation: 'routing_areas';
        referencedColumns: ['id'];
      },
    ];
  };
};

export type RoutingConditionsFunctions = {
  clear_evacuation_center_entrance: {
    Args: { p_center_id: string };
    Returns: Json;
  };
  get_routing_conditions_snapshot: {
    Args: { p_area_id: string; p_graph_version?: string };
    Returns: Json;
  };
  map_evacuation_center_entrance: {
    Args: { p_center_id: string; p_graph_version: string; p_node_id: string };
    Returns: Json;
  };
  map_road_closure_edges: {
    Args: { p_closure_id: string; p_edge_ids: string[]; p_graph_version: string };
    Returns: Json;
  };
  publish_road_closure: {
    Args: {
      p_area_id: string;
      p_edge_ids: string[];
      p_geometry: Json;
      p_graph_version: string;
      p_label: string;
      p_observed_at: string;
      p_reason: string;
      p_source_refs: string[];
    };
    Returns: Json;
  };
  register_routing_graph_version: {
    Args: { p_activate: boolean; p_area_id: string; p_graph_version: string };
    Returns: Json;
  };
  reopen_road_closure: {
    Args: { p_closure_id: string; p_reason: string };
    Returns: Json;
  };
  set_evacuation_center_entrance: {
    Args: { p_center_id: string; p_graph_version: string; p_lat: number; p_lng: number; p_node_id: string };
    Returns: Json;
  };
};
