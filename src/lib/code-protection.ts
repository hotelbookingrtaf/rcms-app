import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Hook สำหรับป้องกันการคัดลอก Source Code, ป้องกันการเปิด DevTools,
 * ป้องกัน Right-Click และแป้นพิมพ์ลัด Inspect Element
 */
export function useCodeProtection() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastToastTime = 0;
    const showWarning = (msg = "ระบบสงวนลิขสิทธิ์และป้องกันการตรวจสอบ Source Code") => {
      const now = Date.now();
      if (now - lastToastTime > 3000) {
        lastToastTime = now;
        toast.warning(msg, { duration: 2500 });
      }
    };

    // 1. ป้องกัน Right-Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // อนุญาตคลิกขวาเฉพาะในช่อง input และ textarea หากผู้ใช้ต้องการวางข้อความ
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      showWarning("ไม่อนุญาตให้คลิกขวาเพื่อดูต้นฉบับโค้ด (Protected)");
    };

    // 2. ป้องกันแป้นพิมพ์ลัดสำหรับ Inspect Element / View Source / Save / DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // F12: เปิด DevTools
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        showWarning("ไม่อนุญาตให้เปิด Developer Tools (F12)");
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (ctrlOrCmd) {
        const key = e.key.toLowerCase();

        // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C: Inspect Elements / Console
        if (e.shiftKey && (key === "i" || key === "j" || key === "c")) {
          e.preventDefault();
          e.stopPropagation();
          showWarning("ไม่อนุญาตให้ตรวจสอบ Source Code (Inspect Element)");
          return;
        }

        // Ctrl+U: View Page Source
        if (key === "u") {
          e.preventDefault();
          e.stopPropagation();
          showWarning("ไม่อนุญาตให้ดู View Page Source");
          return;
        }

        // Ctrl+S: Save Web Page Source
        if (key === "s") {
          e.preventDefault();
          e.stopPropagation();
          showWarning("ไม่อนุญาตให้บันทึกไฟล์หน้าเว็บ");
          return;
        }

        // Ctrl+A: Select All (ยกเว้นในช่อง input/textarea)
        if (key === "a" && !isInput) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Ctrl+C: Copy (อนุญาตเฉพาะในช่อง input/textarea หรือ .select-all)
        if (key === "c" && !isInput) {
          const selection = window.getSelection();
          const selectedText = selection?.toString() || "";
          const anchorNode = selection?.anchorNode?.parentElement;
          if (anchorNode && anchorNode.closest(".select-all")) {
            return;
          }
          if (selectedText.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            showWarning("เนื้อหาและโค้ดของระบบได้รับการคุ้มครองความปลอดภัย");
          }
        }
      }
    };

    // 3. ป้องกันการลากรูปภาพและ elements (Drag & Drop)
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "IMG" || target.tagName === "A")) {
        e.preventDefault();
      }
    };

    // 4. แสดงข้อความเตือนความปลอดภัยใน Console
    const printSecurityBanner = () => {
      try {
        console.clear();
        console.log(
          "%c🛡️ RCMS SECURITY & CODE PROTECTION",
          "background: #8b0000; color: #ffffff; font-size: 18px; font-weight: bold; padding: 6px 14px; border-radius: 6px;"
        );
        console.log(
          "%cระบบบริหารจัดเก็บรายได้ กรมช่างโยธาทหารอากาศ (ชย.ทอ.)\nสงวนลิขสิทธิ์ ห้ามคัดลอก ดัดแปลง หรือตรวจสอบ Source Code โดยไม่ได้รับอนุญาต",
          "color: #dc2626; font-size: 13px; font-weight: bold; line-height: 1.5;"
        );
      } catch {}
    };

    printSecurityBanner();

    // 5. ตรวจจับการเปิด DevTools ผ่านการวัดความกว้างหน้าต่าง
    let devToolsCheckInterval: ReturnType<typeof setInterval> | null = null;
    try {
      devToolsCheckInterval = setInterval(() => {
        const threshold = 160;
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        if (widthDiff > threshold || heightDiff > threshold) {
          printSecurityBanner();
        }
      }, 2500);
    } catch {}

    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("dragstart", handleDragStart, { capture: true });

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("dragstart", handleDragStart, { capture: true });
      if (devToolsCheckInterval) clearInterval(devToolsCheckInterval);
    };
  }, []);
}
