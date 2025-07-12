// types/interfaces.ts

export interface IFollow {
  follower_id: string;
  following_id: string;
}

export interface INotification {
  id?: number;
  sender_id: string;
  recipient_id: string;
  type: string;
  message: string;
  created_at?: string;
}

export interface IPost {
  id?: number;
  user_id: string;
  content: string;
  created_at?: string;
}

export interface IResponse<T> {
  status: number;
  message: string;
  data: {
    success?: T;
    failure?: T;
  };
}
