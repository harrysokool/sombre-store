"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Star,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";

import {
  addProductImageAction,
  moveProductImageAction,
  removeProductImageAction,
  setPrimaryProductImageAction,
  updateProductImageAltTextAction,
  type ProductImageActionState,
} from "@/app/admin/products/image-actions";
import { PRODUCT_IMAGE_TEXT_LIMITS } from "@/lib/admin/product-image-rules";
import type { AdminProductImage } from "@/lib/admin/product-images";

const initialActionState: ProductImageActionState = { error: null };

const fieldLabelClassName =
  "inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-stone-400";
const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50";
const iconButtonClassName =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-40 sm:size-9";
const destructiveIconButtonClassName =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-400/25 bg-red-400/5 text-red-200 transition-colors hover:border-red-400/40 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:size-9";
const orderingButtonClassName =
  "inline-flex h-7 w-10 items-center justify-center text-stone-400 transition-colors hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent sm:h-6 sm:w-9";
const confirmButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-2 text-xs uppercase tracking-[0.14em] text-red-200 transition-colors hover:border-red-400/40 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-50";
const cancelButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-stone-300 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50";
const submitButtonClassName =
  "rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.2em] text-stone-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50";

const ICON_CLASS = "size-4";

function ImagePreview({ image }: { image: AdminProductImage }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
      <Image
        src={image.imageUrl}
        alt={image.altText || `Preview of ${image.imageUrl}`}
        width={64}
        height={64}
        sizes="64px"
        className="h-full w-full object-contain p-1.5"
      />
    </div>
  );
}

function ProductImageRow({
  productId,
  image,
  isFirst,
  isLast,
}: {
  productId: string;
  image: AdminProductImage;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [altState, altFormAction, isSavingAlt] = useActionState(
    updateProductImageAltTextAction,
    initialActionState,
  );
  const [primaryState, primaryFormAction, isSettingPrimary] = useActionState(
    setPrimaryProductImageAction,
    initialActionState,
  );
  // One hook per direction so the pending indicator lands on the button that
  // was actually pressed rather than on both.
  const [moveUpState, moveUpFormAction, isMovingUp] = useActionState(
    moveProductImageAction,
    initialActionState,
  );
  const [moveDownState, moveDownFormAction, isMovingDown] = useActionState(
    moveProductImageAction,
    initialActionState,
  );
  const [removeState, removeFormAction, isRemoving] = useActionState(
    removeProductImageAction,
    initialActionState,
  );
  // Controlled so a refused save keeps the administrator's wording instead of
  // reverting to what is still stored.
  const [altText, setAltText] = useState(image.altText);
  // Removal is irreversible, so the destructive button never submits on its
  // own: the first press only asks.
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  const error =
    altState.error ??
    primaryState.error ??
    moveUpState.error ??
    moveDownState.error ??
    removeState.error;
  const isBusy =
    isSavingAlt ||
    isSettingPrimary ||
    isMovingUp ||
    isMovingDown ||
    isRemoving;

  return (
    <li className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-start gap-3 sm:flex-nowrap">
        <ImagePreview image={image} />

        <div className="min-w-0 flex-1 space-y-2">
          <p className="break-all font-mono text-xs text-stone-300">
            {image.imageUrl}
          </p>

          <form action={altFormAction} className="flex min-w-0 gap-2">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="imageId" value={image.id} />
            <input
              type="text"
              name="altText"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              maxLength={PRODUCT_IMAGE_TEXT_LIMITS.altText}
              disabled={isBusy}
              placeholder="Alt text"
              aria-label={`Alt text for ${image.imageUrl}`}
              className={`${inputClassName} py-2`}
            />
            <button
              type="submit"
              disabled={isBusy || altText === image.altText}
              aria-busy={isSavingAlt}
              aria-label={`Save alt text for ${image.imageUrl}`}
              className={iconButtonClassName}
            >
              {isSavingAlt ? (
                <LoaderCircle className={`${ICON_CLASS} animate-spin`} />
              ) : (
                <Check className={ICON_CLASS} />
              )}
            </button>
          </form>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {image.isPrimary ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-stone-100">
              <Star className="size-3 fill-current" aria-hidden="true" />
              Primary
            </span>
          ) : (
            <form action={primaryFormAction}>
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="imageId" value={image.id} />
              <button
                type="submit"
                disabled={isBusy}
                aria-busy={isSettingPrimary}
                aria-label={`Make primary: ${image.imageUrl}`}
                className={iconButtonClassName}
              >
                {isSettingPrimary ? (
                  <LoaderCircle className={`${ICON_CLASS} animate-spin`} />
                ) : (
                  <Star className={ICON_CLASS} />
                )}
              </button>
            </form>
          )}

          {isConfirmingRemove ? null : (
            <button
              type="button"
              onClick={() => setIsConfirmingRemove(true)}
              disabled={isBusy}
              aria-label={`Remove image: ${image.imageUrl}`}
              className={destructiveIconButtonClassName}
            >
              <Trash2 className={ICON_CLASS} />
            </button>
          )}

          {/* Ordering sits apart from the item actions: moving an image is a
              different kind of change from editing it. */}
          <div
            role="group"
            aria-label={`Reorder image: ${image.imageUrl}`}
            className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-white/10"
          >
            <form action={moveUpFormAction}>
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="imageId" value={image.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={isFirst || isBusy}
                aria-busy={isMovingUp}
                aria-label={`Move image up: ${image.imageUrl}`}
                className={orderingButtonClassName}
              >
                {isMovingUp ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <ChevronUp className="size-3.5" />
                )}
              </button>
            </form>

            <div aria-hidden="true" className="h-px bg-white/10" />

            <form action={moveDownFormAction}>
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="imageId" value={image.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={isLast || isBusy}
                aria-busy={isMovingDown}
                aria-label={`Move image down: ${image.imageUrl}`}
                className={orderingButtonClassName}
              >
                {isMovingDown ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {isConfirmingRemove ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-xs leading-5 text-red-200">
            Remove this image? This cannot be undone.
          </p>
          <form action={removeFormAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="imageId" value={image.id} />
            <button
              type="submit"
              disabled={isRemoving}
              aria-label={`Confirm remove image: ${image.imageUrl}`}
              className={confirmButtonClassName}
            >
              {isRemoving ? "Removing…" : "Confirm remove"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setIsConfirmingRemove(false)}
            disabled={isRemoving}
            aria-label={`Keep image: ${image.imageUrl}`}
            className={cancelButtonClassName}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs leading-5 text-red-300">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function AddProductImageForm({ productId }: { productId: string }) {
  const [state, formAction, isPending] = useActionState(
    addProductImageAction,
    initialActionState,
  );
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  // Controlled, so a refused add keeps what was typed rather than making the
  // administrator retype a nearly-right path.
  //
  // React hands back a new state object every time the action settles, which is
  // the signal that a submission finished. Comparing it against the last one
  // during render — rather than from an effect — is React's own way to adjust
  // state in response to a change, and avoids the extra commit and cascading
  // render an effect would cost.
  const [settledState, setSettledState] = useState(state);

  if (state !== settledState) {
    setSettledState(state);

    // A successful add clears the fields ready for the next image.
    if (!state.error) {
      setImageUrl("");
      setAltText("");
    }
  }

  return (
    <form
      action={formAction}
      aria-label="Add product image"
      className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 sm:grid-cols-2 sm:px-6"
    >
      <input type="hidden" name="productId" value={productId} />

      <div className="space-y-2">
        <span className={fieldLabelClassName}>
          <label htmlFor="imageUrl">Image path</label>
        </span>
        <input
          id="imageUrl"
          type="text"
          name="imageUrl"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          maxLength={PRODUCT_IMAGE_TEXT_LIMITS.imageUrl}
          required
          disabled={isPending}
          spellCheck={false}
          autoComplete="off"
          placeholder="/images/products/maison-margiela/replica-jazz-club-01.jpg"
          className={inputClassName}
        />
      </div>

      <div className="space-y-2">
        <span className={fieldLabelClassName}>
          <label htmlFor="newAltText">Alt text</label>
        </span>
        <input
          id="newAltText"
          type="text"
          name="altText"
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          maxLength={PRODUCT_IMAGE_TEXT_LIMITS.altText}
          disabled={isPending}
          placeholder="Maison Margiela Replica Jazz Club perfume bottle"
          className={inputClassName}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm leading-6 text-red-200 sm:col-span-2"
        >
          {state.error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className={submitButtonClassName}
        >
          {isPending ? "Adding…" : "Add image"}
        </button>
      </div>
    </form>
  );
}

export function ProductImagesEditor({
  productId,
  images,
}: {
  productId: string;
  images: AdminProductImage[];
}) {
  return (
    <section aria-labelledby="product-images-heading" className="space-y-4">
      <h2
        id="product-images-heading"
        className="text-xl font-medium tracking-[0.08em] text-stone-100"
      >
        Images
      </h2>

      <AddProductImageForm productId={productId} />

      {images.length > 0 ? (
        <ul aria-label="Product images" className="space-y-3">
          {images.map((image, index) => (
            <ProductImageRow
              key={image.id}
              productId={productId}
              image={image}
              isFirst={index === 0}
              isLast={index === images.length - 1}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-stone-400">
          This product has no images.
        </p>
      )}
    </section>
  );
}
