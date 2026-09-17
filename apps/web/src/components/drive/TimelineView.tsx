"use client";



import type { ImageItem, TimelineGroup } from "@/lib/types";

import { ImageCardDetails } from "@/components/drive/ImageCardDetails";

import { ImageThumbWithFavorite } from "@/components/drive/ImageThumbWithFavorite";

import { writeImageDragData } from "@/components/drive/image-drag";
import { handleImageDoubleClick, handleImagePrimaryClick } from "@/components/drive/image-open";
import {
  DRIVE_SELECT_SURFACE,
  IMAGE_CARD_SELECT_BORDER_BASE,
  IMAGE_CARD_SELECTED_CLASS,
} from "@/components/drive/constants";
import { DRIVE_IMAGE_SELECT_ATTR } from "@/components/drive/marquee-select";

import { cn } from "@/lib/utils";



type TimelineViewProps = {

  groups: TimelineGroup[];

  openPreview: (img: ImageItem) => void;

  isImageSelected: (id: string) => boolean;

  onImageSelectClick: (e: React.MouseEvent, img: ImageItem) => void;

  selectedImageIds: ReadonlySet<string>;

  ImageThumb: React.ComponentType<{ img: ImageItem; className?: string }>;

  VisibilityBadge: React.ComponentType<{ visibility: string }>;

  posterLabelFor: (img: ImageItem) => string;

  showFavoriteStar: boolean;

  onToggleFavorite: (img: ImageItem) => void;

  isImageTagging?: (id: string) => boolean;

  getTaggingElapsed?: (id: string) => number;

};



export function TimelineView({

  groups,

  openPreview,

  isImageSelected,

  onImageSelectClick,

  selectedImageIds,

  ImageThumb,

  VisibilityBadge,

  posterLabelFor,

  showFavoriteStar,

  onToggleFavorite,

  isImageTagging,

  getTaggingElapsed,

}: TimelineViewProps) {

  if (!groups.length) {

    return (

      <p className="py-12 text-center text-[14px] text-[var(--muted-foreground)]">

        No photos with dates yet. Upload images — we read EXIF dates when available.

      </p>

    );

  }



  return (

    <div className="space-y-8">

      {groups.map((group) => (

        <section key={group.period}>

          <h3 className="mb-3 text-[14px] font-bold uppercase tracking-wide text-[var(--header-secondary)]">

            {group.label}

          </h3>

          <div className="grid grid-cols-2 items-stretch gap-3 p-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">

            {group.images.map((img) => (

              <div

                key={img.id}

                {...{ [DRIVE_IMAGE_SELECT_ATTR]: img.id }}

                draggable

                onDragStart={(e) => writeImageDragData(e, img.id, selectedImageIds)}

                role="button"

                tabIndex={0}

                onClick={(e) =>
                  handleImagePrimaryClick(e, img, onImageSelectClick, openPreview)
                }

                onDoubleClick={(e) => handleImageDoubleClick(e, img, openPreview)}

                onKeyDown={(e) => {

                  if (e.key === "Enter") {

                    e.preventDefault();

                    openPreview(img);

                  }

                }}

                className={cn(
                  "group flex h-full flex-col rounded-[8px] border-2 bg-[var(--bg-secondary)] p-2 text-left outline-none transition-colors hover:bg-[#35373c] focus:outline-none focus-visible:outline-none",
                  DRIVE_SELECT_SURFACE,
                  IMAGE_CARD_SELECT_BORDER_BASE,
                  isImageSelected(img.id) && IMAGE_CARD_SELECTED_CLASS,
                )}

              >

                <ImageThumbWithFavorite

                  img={img}

                  className="aspect-square w-full rounded-[4px]"

                  ImageThumb={ImageThumb}

                  showFavorite={showFavoriteStar}

                  onToggleFavorite={onToggleFavorite}
                />

                <div className="mt-2 min-w-0">
                  <ImageCardDetails
                    img={img}
                    ownerLabel={posterLabelFor(img)}
                    VisibilityBadge={VisibilityBadge}
                    compact
                    isTagging={isImageTagging?.(img.id)}
                    taggingElapsedSec={getTaggingElapsed?.(img.id)}
                    onOpenPreview={() => openPreview(img)}
                  />
                </div>

              </div>

            ))}

          </div>

        </section>

      ))}

    </div>

  );

}


