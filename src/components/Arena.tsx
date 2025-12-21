import { createAsync } from "@solidjs/router";
import { Show, Index } from "solid-js";
import { getChannelContents } from "~/libs/actions/arena/channels";
import type { ArenaBlock, ArenaChannelContents } from "~/libs/schemas/arena";
import { logger } from "~/libs/utils/logger";
import { Spinner } from "./Spinner";

interface ArenaCarouselProps {
	slug: string;
	title?: string;
}

export function ArenaCarousel(props: ArenaCarouselProps) {
	const contents = createAsync(() =>
		getChannelContents(props.slug, { per: 10 }),
	);

	return (
		<Show when={contents()} fallback={<Spinner />}>
			{(response) => (
				<Show
					when={response().contents && response().contents.length > 0}
					fallback={
						<>
							{logger.warn(
								`Warning: no contents found for channel slug "${props.slug}"`,
							)}
							<p>Sorry, no content found</p>
						</>
					}
				>
					<div class="overflow-x-auto whitespace-nowrap border border-black">
						<div class="carousel-container inline-flex gap-4 p-4">
							<Index each={response().contents}>
								{(item) => (
									<div class="carousel-item flex-shrink-0 w-80">
										<ArenaItem item={item()} />
									</div>
								)}
							</Index>
						</div>
					</div>
					<p class="text-xs mt-2">
						Source:{" "}
						<a
							href={`https://are.na/tom/${props.slug}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							{props.title || props.slug}
						</a>
					</p>
				</Show>
			)}
		</Show>
	);
}

function ArenaItem(props: { item: ArenaChannelContents }) {
	const item = () => props.item;

	return (
		<Show when={item().base_class === "Block"}>
			<ArenaBlockItem block={item() as ArenaBlock} />
		</Show>
	);
}

function ImageBlock(props: { block: ArenaBlock }) {
	const block = () => props.block;

	return (
		<div class="image-block relative w-full h-60 bg-gray-100">
			<img
				src={block().image?.display.url}
				alt={block().title || block().generated_title || ""}
				class="w-full h-full object-cover"
			/>
		</div>
	);
}

function ArenaBlockItem(props: { block: ArenaBlock }) {
	const block = () => props.block;

	return (
		<div class="arena-block p-4">
			<Show when={block().class === "Image"}>
				<ImageBlock block={block()} />
			</Show>
			<Show when={block().class === "Text"}>
				<div class="text-content prose prose-sm break-words whitespace-normal">
					{block().content_html ? (
						<div innerHTML={block().content_html || ""} />
					) : (
						<p>{block().content}</p>
					)}
				</div>
			</Show>
			<Show when={block().class === "Link"}>
				<LinkBlock block={block()} />
			</Show>
			<Show when={block().class === "Attachment"}>
				<AttachmentBlock block={block()} />
			</Show>
			<Show when={block().class === "Media"}>
				<div class="media-content">
					{(() => {
						const embed = block().embed;
						if (embed?.html) {
							return <div innerHTML={embed.html} />;
						}
						return (
							<a
								href={block().source?.url || ""}
								target="_blank"
								rel="noopener noreferrer"
								class="block no-underline hover:underline"
							>
								{block().title || block().generated_title}
							</a>
						);
					})()}
				</div>
			</Show>
		</div>
	);
}

function LinkBlock(props: { block: ArenaBlock }) {
	const block = () => props.block;

	return (
		<a
			href={block().source?.url || ""}
			target="_blank"
			rel="noopener noreferrer"
			class="block no-underline hover:underline"
		>
			<Show when={block().image}>
				<div class="relative w-full h-60 bg-gray-100">
					<img
						src={block().image?.display.url}
						alt={block().title || block().generated_title || ""}
						class="w-full h-full object-cover"
						onError={() => logger.error("Failed to load arena link image")}
					/>
				</div>
			</Show>
			<div class="link-title mt-2 text-sm break-words whitespace-normal">
				<p>
					{block().title || block().source?.title || block().generated_title}
				</p>
			</div>
		</a>
	);
}

function AttachmentBlock(props: { block: ArenaBlock }) {
	const block = () => props.block;

	const fileName = () => block().attachment?.file_name || "";
	const fileUrl = () => block().attachment?.url || "";
	const isAudio = () => fileName().toLowerCase().endsWith(".mp3");
	const isVideo = () => fileName().toLowerCase().endsWith(".mp4");

	return (
		<div class="attachment-block">
			<Show when={isAudio() || isVideo()}>
				<div class="media-container relative w-full h-60 bg-black">
					<Show when={isAudio()}>
						<audio src={fileUrl()} controls class="w-full h-full">
							Your browser does not support the audio element.
						</audio>
					</Show>

					<Show when={isVideo()}>
						<video
							src={fileUrl()}
							controls
							class="w-full h-full object-contain"
						>
							Your browser does not support the video element.
						</video>
					</Show>
				</div>
			</Show>

			<Show when={!isAudio() && !isVideo()}>
				<a
					href={fileUrl()}
					download={fileName()}
					class="block no-underline hover:underline"
					onError={() => logger.error("Failed to load arena media attachment")}
				>
					<div class="attachment p-2 border border-gray-300 text-sm">
						{fileName()}
						<div class="file-size text-xs text-gray-600">
							{block().attachment?.file_size_display}
						</div>
					</div>
				</a>
			</Show>
		</div>
	);
}
