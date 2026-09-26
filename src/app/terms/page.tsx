import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: "Các điều khoản áp dụng khi sử dụng Kotoba.",
};

const sections = [
  {
    title: "Chấp nhận điều khoản",
    paragraphs: [
      "Khi đăng nhập hoặc sử dụng Kotoba, bạn đồng ý với các điều khoản dưới đây và Chính sách quyền riêng tư. Nếu không đồng ý, bạn không nên tiếp tục sử dụng dịch vụ.",
    ],
  },
  {
    title: "Tài khoản và vai trò",
    paragraphs: [
      "Bạn đăng nhập bằng tài khoản Google và chịu trách nhiệm bảo vệ quyền truy cập tài khoản đó. Trong lần đầu sử dụng, bạn chọn vai trò giáo viên hoặc học sinh; vai trò này được cố định để bảo vệ quyền truy cập lớp học.",
    ],
  },
  {
    title: "Sử dụng phù hợp",
    items: [
      "Chỉ sử dụng Kotoba cho mục đích học tập và giảng dạy hợp pháp.",
      "Không truy cập trái phép dữ liệu, lớp học hoặc tài khoản của người khác.",
      "Không tải lên nội dung vi phạm quyền sở hữu trí tuệ, quyền riêng tư hoặc pháp luật hiện hành.",
      "Không gây gián đoạn, dò quét hoặc tìm cách vượt qua các biện pháp bảo vệ của dịch vụ.",
    ],
  },
  {
    title: "Nội dung lớp học",
    paragraphs: [
      "Giáo viên chịu trách nhiệm về tính chính xác và quyền sử dụng của nội dung bài học do mình tạo hoặc nhập vào. Học sinh chỉ được sử dụng nội dung lớp học trong phạm vi mà giáo viên cho phép.",
    ],
  },
  {
    title: "Tính sẵn sàng của dịch vụ",
    paragraphs: [
      "Kotoba được cung cấp theo tình trạng hiện có. Dịch vụ có thể tạm ngừng để bảo trì, sửa lỗi hoặc do nhà cung cấp hạ tầng. Kotoba không cam kết rằng lịch ôn hoặc nội dung do người dùng tạo phù hợp với mọi mục tiêu học tập.",
    ],
  },
  {
    title: "Chấm dứt sử dụng",
    paragraphs: [
      "Quyền truy cập có thể bị hạn chế nếu tài khoản vi phạm điều khoản, gây hại cho dịch vụ hoặc cho người dùng khác. Bạn có thể ngừng sử dụng Kotoba bất cứ lúc nào.",
    ],
  },
  {
    title: "Thay đổi điều khoản",
    paragraphs: [
      "Kotoba có thể cập nhật các điều khoản này khi sản phẩm thay đổi. Việc tiếp tục sử dụng sau khi phiên bản mới được đăng đồng nghĩa với việc bạn chấp nhận nội dung cập nhật.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Điều khoản sử dụng"
      description="Những nguyên tắc ngắn gọn để Kotoba luôn là một không gian học tập riêng tư, hữu ích và an toàn."
      sections={sections}
    />
  );
}
