"use client";
import { LogOut } from "lucide-react";
import type { Member } from "@/lib/model";
import Avatar from "./avatar";
import ChoicePicker from "./choice-picker";

export default function MemberPicker({
  members,
  value,
  onChange,
  onLogout,
  busy = false,
}: {
  members: Member[];
  value: string;
  onChange: (id: string) => void;
  onLogout: () => void;
  busy?: boolean;
}) {
  return (
    <ChoicePicker
      title="구성원 선택"
      variant="members"
      value={value}
      onChange={onChange}
      footer={
        <button type="button" onClick={onLogout} disabled={busy}>
          <LogOut size={14} /> 로그아웃
        </button>
      }
      choices={members.map((member, index) => ({
        value: member.id,
        label: member.name,
        icon: <Avatar member={member} index={index} small />,
      }))}
    />
  );
}
