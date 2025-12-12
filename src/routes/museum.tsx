import { CameraRoll } from "~/components/CameraRoll";
import PageLayout from "~/components/PageLayout";

export default function Museum() {
	return (
		<>
			<PageLayout title="Museum" description="Atlas of images">
				<CameraRoll slug="imaginary-museum" title="Tom's camera roll" />
			</PageLayout>
		</>
	);
}
