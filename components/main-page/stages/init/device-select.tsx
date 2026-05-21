"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store/store";
import { useEffect, useState } from "react";
import { useToast } from "../../../ui/use-toast";

export function DeviceSelect() {
  const { updateStore, deviceId } = useAppStore();
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const check = async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: true });
        st.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const filt = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
        setDevices(filt.map((d) => ({ id: d.deviceId, label: d.label })));

        if (filt.length) updateStore({ deviceId: filt[0]?.deviceId });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "카메라 권한이 거부됨",
          description: "이 앱을 사용하려면 카메라 접근을 허용해주세요.",
        });
      }
    };

    check();
  }, []);

  return (
    <Select value={deviceId} onValueChange={(id) => updateStore({ deviceId: id })}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="카메라를 선택하세요" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>카메라 선택</SelectLabel>
          {devices.map((device) => (
            <SelectItem key={`device-sel-${device.id}`} value={device.id}>
              {device.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
